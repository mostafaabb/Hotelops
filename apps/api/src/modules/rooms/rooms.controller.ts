import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  BlockReason,
  HousekeepingStatus,
  RoomMaintenanceStatus,
  RoomOperationalStatus,
  UserRole,
} from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { RoomsService } from './rooms.service';

class CreateRoomDto {
  @ApiProperty({ example: '101' })
  @IsString()
  @IsNotEmpty()
  roomNumber: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  roomTypeId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  hotelId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  buildingId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  floorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  floorPosition?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ enum: RoomOperationalStatus })
  @IsOptional()
  @IsEnum(RoomOperationalStatus)
  status?: RoomOperationalStatus;

  @ApiPropertyOptional({ enum: HousekeepingStatus })
  @IsOptional()
  @IsEnum(HousekeepingStatus)
  housekeepingStatus?: HousekeepingStatus;
}

class UpdateRoomDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  roomNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  roomTypeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  buildingId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  floorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  floorPosition?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ enum: RoomOperationalStatus })
  @IsOptional()
  @IsEnum(RoomOperationalStatus)
  status?: RoomOperationalStatus;

  @ApiPropertyOptional({ enum: HousekeepingStatus })
  @IsOptional()
  @IsEnum(HousekeepingStatus)
  housekeepingStatus?: HousekeepingStatus;

  @ApiPropertyOptional({ enum: RoomMaintenanceStatus })
  @IsOptional()
  @IsEnum(RoomMaintenanceStatus)
  maintenanceStatus?: RoomMaintenanceStatus;
}

class ChangeStatusDto {
  @ApiPropertyOptional({ enum: RoomOperationalStatus })
  @IsOptional()
  @IsEnum(RoomOperationalStatus)
  status?: RoomOperationalStatus;

  @ApiPropertyOptional({ enum: HousekeepingStatus })
  @IsOptional()
  @IsEnum(HousekeepingStatus)
  housekeepingStatus?: HousekeepingStatus;

  @ApiPropertyOptional({ enum: RoomMaintenanceStatus })
  @IsOptional()
  @IsEnum(RoomMaintenanceStatus)
  maintenanceStatus?: RoomMaintenanceStatus;
}

class BlockRoomDto {
  @ApiProperty({ enum: BlockReason })
  @IsEnum(BlockReason)
  reason: BlockReason;

  @ApiProperty()
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

const WRITE_ROLES: UserRole[] = [
  UserRole.OWNER,
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER,
  UserRole.HOTEL_MANAGER,
];

const STATUS_CHANGE_ROLES: UserRole[] = [
  ...WRITE_ROLES,
  UserRole.HOUSEKEEPING_MANAGER,
  UserRole.FRONT_DESK,
];

@ApiTags('rooms')
@Controller('rooms')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RoomsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roomsService: RoomsService,
    private readonly auditService: AuditService,
  ) {}

  @Get('stats')
  @Roles(...STATUS_CHANGE_ROLES)
  async stats(
    @CurrentUser() user: AuthenticatedUser,
    @Query('hotelId') hotelId?: string
  ) {
    const where: Record<string, unknown> = {
      organizationId: user.organizationId,
    };
    if (hotelId) where.hotelId = hotelId;

    const rooms = await this.prisma.room.findMany({
      where,
      select: { status: true, housekeepingStatus: true },
    });

    const statusCounts: Record<string, number> = {};
    const hkCounts: Record<string, number> = {};

    for (const room of rooms) {
      statusCounts[room.status] = (statusCounts[room.status] || 0) + 1;
      hkCounts[room.housekeepingStatus] =
        (hkCounts[room.housekeepingStatus] || 0) + 1;
    }

    return { total: rooms.length, byStatus: statusCounts, byHousekeepingStatus: hkCounts };
  }

  @Get()
  @Roles(...STATUS_CHANGE_ROLES, UserRole.RESERVATION_AGENT, UserRole.MAINTENANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.STAFF)
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('hotelId') hotelId?: string,
    @Query('roomTypeId') roomTypeId?: string,
    @Query('floorId') floorId?: string,
    @Query('buildingId') buildingId?: string,
    @Query('status') status?: RoomOperationalStatus,
    @Query('housekeepingStatus') housekeepingStatus?: HousekeepingStatus,
    @Query('maintenanceStatus') maintenanceStatus?: RoomMaintenanceStatus
  ) {
    const p = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const ps = Math.min(100, Math.max(1, parseInt(pageSize ?? '20', 10) || 20));
    const where: Record<string, unknown> = {
      organizationId: user.organizationId,
    };

    if (hotelId) where.hotelId = hotelId;
    if (roomTypeId) where.roomTypeId = roomTypeId;
    if (floorId) where.floorId = floorId;
    if (buildingId) where.buildingId = buildingId;
    if (status) where.status = status;
    if (housekeepingStatus) where.housekeepingStatus = housekeepingStatus;
    if (maintenanceStatus) where.maintenanceStatus = maintenanceStatus;
    if (search) {
      where.roomNumber = { contains: search, mode: 'insensitive' };
    }

    const [items, total] = await Promise.all([
      this.prisma.room.findMany({
        where,
        skip: (p - 1) * ps,
        take: ps,
        orderBy: { roomNumber: 'asc' },
        include: {
          roomType: true,
          floor: true,
          building: true,
        },
      }),
      this.prisma.room.count({ where }),
    ]);

    return { items, total, page: p, pageSize: ps };
  }

  @Get(':id')
  @Roles(...STATUS_CHANGE_ROLES, UserRole.RESERVATION_AGENT, UserRole.MAINTENANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.STAFF)
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    const room = await this.prisma.room.findFirst({
      where: { id, organizationId: user.organizationId },
      include: {
        roomType: { include: { amenities: { include: { amenity: true } } } },
        building: true,
        floor: true,
        reservations: {
          where: {
            status: { in: ['CONFIRMED', 'CHECKED_IN'] },
          },
          take: 1,
          include: { guest: true },
        },
        maintenanceRequests: {
          where: { status: { notIn: ['RESOLVED', 'CLOSED'] } },
          take: 5,
        },
        roomBlocks: {
          where: {
            OR: [
              { endDate: null },
              { endDate: { gte: new Date() } },
            ],
          },
          take: 5,
        },
      },
    });
    if (!room) throw new NotFoundException('Room not found');

    const { reservations, roomType, ...roomData } = room;
    return {
      ...roomData,
      roomType: {
        ...roomType,
        amenities: roomType.amenities.map((ra) => ra.amenity),
      },
      currentReservation: reservations[0] ?? null,
      openMaintenanceRequests: room.maintenanceRequests,
      activeRoomBlocks: room.roomBlocks,
    };
  }

  @Post()
  @Roles(...WRITE_ROLES)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRoomDto
  ) {
    const hotel = await this.prisma.hotel.findFirst({
      where: { id: dto.hotelId, organizationId: user.organizationId },
    });
    if (!hotel) throw new NotFoundException('Hotel not found');

    const roomType = await this.prisma.roomType.findFirst({
      where: { id: dto.roomTypeId, organizationId: user.organizationId },
    });
    if (!roomType) throw new NotFoundException('Room type not found');

    const existing = await this.prisma.room.findFirst({
      where: { hotelId: dto.hotelId, roomNumber: dto.roomNumber },
    });
    if (existing) {
      throw new BadRequestException('A room with this number already exists in this hotel');
    }

    return this.prisma.room.create({
      data: {
        organizationId: user.organizationId,
        hotelId: dto.hotelId,
        roomTypeId: dto.roomTypeId,
        roomNumber: dto.roomNumber,
        buildingId: dto.buildingId,
        floorId: dto.floorId,
        floorPosition: dto.floorPosition,
        notes: dto.notes,
        status: dto.status ?? RoomOperationalStatus.AVAILABLE,
        housekeepingStatus: dto.housekeepingStatus ?? HousekeepingStatus.CLEAN,
      },
    });
  }

  @Patch(':id')
  @Roles(...WRITE_ROLES)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateRoomDto
  ) {
    await this.roomsService.validateOrgRoom(id, user.organizationId);

    return this.prisma.room.update({
      where: { id },
      data: dto as never,
    });
  }

  @Patch(':id/status')
  @Roles(...STATUS_CHANGE_ROLES)
  async changeStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ChangeStatusDto
  ) {
    return this.roomsService.changeStatus(id, user.id, user.organizationId, dto);
  }

  @Post(':id/block')
  @Roles(...WRITE_ROLES)
  async blockRoom(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: BlockRoomDto
  ) {
    return this.roomsService.blockRoom(id, user.id, user.organizationId, {
      ...dto,
      startDate: new Date(dto.startDate),
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
    });
  }

  @Delete(':id/block/:blockId')
  @Roles(...WRITE_ROLES)
  async removeBlock(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('blockId') blockId: string
  ) {
    return this.roomsService.removeBlock(id, blockId, user.id, user.organizationId);
  }
}
