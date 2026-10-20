import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { BlockReason, HousekeepingStatus, RoomMaintenanceStatus, RoomOperationalStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async validateOrgRoom(roomId: string, organizationId: string) {
    const room = await this.prisma.room.findFirst({
      where: { id: roomId, organizationId },
    });
    if (!room) throw new NotFoundException('Room not found');
    return room;
  }

  async changeStatus(
    roomId: string,
    userId: string,
    organizationId: string,
    data: {
      status?: RoomOperationalStatus;
      housekeepingStatus?: HousekeepingStatus;
      maintenanceStatus?: RoomMaintenanceStatus;
    }
  ) {
    const room = await this.validateOrgRoom(roomId, organizationId);

    if (data.status === RoomOperationalStatus.OCCUPIED) {
      throw new BadRequestException(
        'Cannot set status to OCCUPIED via this endpoint. Use front desk check-in.'
      );
    }

    const updated = await this.prisma.room.update({
      where: { id: roomId },
      data: {
        ...(data.status !== undefined && { status: data.status }),
        ...(data.housekeepingStatus !== undefined && {
          housekeepingStatus: data.housekeepingStatus,
        }),
        ...(data.maintenanceStatus !== undefined && {
          maintenanceStatus: data.maintenanceStatus,
        }),
      },
    });

    await this.auditService.record(userId, organizationId, 'CHANGE', 'Room', roomId, {
      oldValue: {
        status: room.status,
        housekeepingStatus: room.housekeepingStatus,
        maintenanceStatus: room.maintenanceStatus,
      },
      newValue: data,
    });

    return updated;
  }

  async blockRoom(
    roomId: string,
    userId: string,
    organizationId: string,
    data: {
      reason: BlockReason;
      startDate: Date;
      endDate?: Date;
      note?: string;
    }
  ) {
    const room = await this.validateOrgRoom(roomId, organizationId);

    const block = await this.prisma.roomBlock.create({
      data: {
        roomId,
        reason: data.reason,
        startDate: data.startDate,
        endDate: data.endDate,
        note: data.note,
        createdBy: userId,
      },
    });

    const newStatus =
      data.reason === BlockReason.MAINTENANCE ||
      data.reason === BlockReason.RENOVATION
        ? RoomOperationalStatus.OUT_OF_ORDER
        : RoomOperationalStatus.OUT_OF_SERVICE;

    await this.prisma.room.update({
      where: { id: roomId },
      data: { status: newStatus },
    });

    await this.auditService.record(userId, organizationId, 'CHANGE', 'Room', roomId, {
      oldValue: { status: room.status },
      newValue: { status: newStatus, blockId: block.id, reason: data.reason },
    });

    return block;
  }

  async removeBlock(
    roomId: string,
    blockId: string,
    userId: string,
    organizationId: string
  ) {
    await this.validateOrgRoom(roomId, organizationId);

    const block = await this.prisma.roomBlock.findFirst({
      where: { id: blockId, roomId },
    });
    if (!block) throw new NotFoundException('Room block not found');

    await this.prisma.roomBlock.delete({ where: { id: blockId } });

    const now = new Date();
    const hasOtherBlocks = await this.prisma.roomBlock.findFirst({
      where: {
        roomId,
        id: { not: blockId },
        OR: [
          { endDate: null, startDate: { lte: now } },
          { endDate: { gte: now }, startDate: { lte: now } },
        ],
      },
    });

    if (!hasOtherBlocks) {
      await this.prisma.room.update({
        where: { id: roomId },
        data: { status: RoomOperationalStatus.AVAILABLE },
      });
    }

    await this.auditService.record(userId, organizationId, 'DELETE', 'RoomBlock', blockId, {
      oldValue: { roomId, reason: block.reason },
    });

    return { success: true };
  }
}
