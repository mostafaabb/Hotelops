import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MaintenanceCategory,
  MaintenanceRequestStatus,
  Prisma,
  RoomMaintenanceStatus,
  TaskPriority,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { startOfDay } from '../../common/utils/date.util';
import { sumMoney } from '../../common/utils/money.util';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

const MANAGER_ROLES = [
  'OWNER',
  'SUPER_ADMIN',
  'GENERAL_MANAGER',
  'HOTEL_MANAGER',
  'MAINTENANCE_MANAGER',
];

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService
  ) {}

  private isManager(user: AuthenticatedUser): boolean {
    return MANAGER_ROLES.includes(user.role);
  }

  private enforceManager(user: AuthenticatedUser) {
    if (!this.isManager(user)) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }

  private enforceStaffAssigned(user: AuthenticatedUser, assignedTo: string | null) {
    if (!this.isManager(user) && user.role === 'MAINTENANCE_STAFF' && assignedTo !== user.id) {
      throw new ForbiddenException('You can only work on requests assigned to you');
    }
    if (!this.isManager(user) && user.role !== 'MAINTENANCE_STAFF') {
      throw new ForbiddenException('Insufficient permissions');
    }
  }

  async findAll(
    user: AuthenticatedUser,
    query: {
      status?: MaintenanceRequestStatus;
      priority?: TaskPriority;
      category?: MaintenanceCategory;
      assignedTo?: string;
      roomId?: string;
      hotelId?: string;
      page?: number;
      pageSize?: number;
    }
  ) {
    const page = query.page || 1;
    const pageSize = Math.min(query.pageSize || 20, 100);
    const filterHotelId = query.hotelId || user.hotelId;

    const where: Prisma.MaintenanceRequestWhereInput = {
      organizationId: user.organizationId,
      ...(filterHotelId ? { hotelId: filterHotelId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.assignedTo ? { assignedTo: query.assignedTo } : {}),
      ...(query.roomId ? { roomId: query.roomId } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.maintenanceRequest.findMany({
        where,
        include: {
          room: { select: { id: true, roomNumber: true } },
          assignedToUser: { select: { id: true, firstName: true, lastName: true } },
          createdByUser: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.maintenanceRequest.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const request = await this.prisma.maintenanceRequest.findFirst({
      where: { id, organizationId: user.organizationId },
      include: {
        room: { include: { roomType: true } },
        assignedToUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        createdByUser: { select: { id: true, firstName: true, lastName: true } },
        resolvedByUser: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!request) throw new NotFoundException('Maintenance request not found');
    return request;
  }

  async dashboard(user: AuthenticatedUser, hotelId?: string) {
    const orgId = user.organizationId;
    const filterHotelId = hotelId || user.hotelId;
    const today = startOfDay(new Date());
    const where: Prisma.MaintenanceRequestWhereInput = { organizationId: orgId };
    if (filterHotelId) where.hotelId = filterHotelId;

    const [open, highPriority, inProgress, resolvedToday, resolved, costs, roomAggs] =
      await Promise.all([
        this.prisma.maintenanceRequest.count({
          where: {
            ...where,
            status: {
              in: [
                MaintenanceRequestStatus.OPEN,
                MaintenanceRequestStatus.ASSIGNED,
                MaintenanceRequestStatus.IN_PROGRESS,
                MaintenanceRequestStatus.WAITING,
              ],
            },
          },
        }),
        this.prisma.maintenanceRequest.count({
          where: {
            ...where,
            status: {
              in: [
                MaintenanceRequestStatus.OPEN,
                MaintenanceRequestStatus.ASSIGNED,
                MaintenanceRequestStatus.IN_PROGRESS,
              ],
            },
            priority: { in: [TaskPriority.HIGH, TaskPriority.URGENT] },
          },
        }),
        this.prisma.maintenanceRequest.count({
          where: { ...where, status: MaintenanceRequestStatus.IN_PROGRESS },
        }),
        this.prisma.maintenanceRequest.count({
          where: { ...where, resolvedAt: { gte: today } },
        }),
        this.prisma.maintenanceRequest.findMany({
          where: { ...where, status: { in: [MaintenanceRequestStatus.RESOLVED, MaintenanceRequestStatus.CLOSED] } },
          select: { createdAt: true, resolvedAt: true },
        }),
        this.prisma.maintenanceRequest.aggregate({
          where: { ...where, cost: { not: null } },
          _sum: { cost: true },
        }),
        this.prisma.maintenanceRequest.groupBy({
          by: ['roomId'],
          where: { ...where, roomId: { not: null } },
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: 5,
        }),
      ]);

    let avgResolutionHours = 0;
    const durations = resolved
      .filter((r) => r.resolvedAt)
      .map((r) => (new Date(r.resolvedAt!).getTime() - new Date(r.createdAt).getTime()) / 3600000);
    if (durations.length > 0) {
      avgResolutionHours = Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10;
    }

    const roomIds = roomAggs.map((a) => a.roomId).filter((id): id is string => !!id);
    const rooms = await this.prisma.room.findMany({
      where: { id: { in: roomIds } },
      select: { id: true, roomNumber: true },
    });
    const roomMap = new Map(rooms.map((r) => [r.id, r.roomNumber]));
    const mostProblematicRooms = roomAggs.map((a) => ({
      roomId: a.roomId as string,
      roomNumber: a.roomId ? roomMap.get(a.roomId) || null : null,
      count: a._count.id,
    }));

    return {
      open,
      highPriority,
      inProgress,
      resolvedToday,
      avgResolutionHours,
      mostProblematicRooms,
      totalCost: sumMoney([costs._sum.cost || 0]),
    };
  }

  async create(user: AuthenticatedUser, dto: {
    roomId?: string;
    category: MaintenanceCategory;
    title: string;
    description?: string;
    priority?: TaskPriority;
    assignedTo?: string;
    cost?: number;
  }) {
    const orgId = user.organizationId;
    let hotelId = user.hotelId;

    if (dto.roomId) {
      const room = await this.prisma.room.findFirst({
        where: { id: dto.roomId, organizationId: orgId },
      });
      if (!room) throw new NotFoundException('Room not found');
      hotelId = room.hotelId;
    }

    if (hotelId) {
      const hotel = await this.prisma.hotel.findFirst({
        where: { id: hotelId, organizationId: orgId },
        select: { id: true },
      });
      if (!hotel) throw new NotFoundException('Hotel not found');
    } else {
      const firstHotel = await this.prisma.hotel.findFirst({
        where: { organizationId: orgId },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      if (!firstHotel) throw new NotFoundException('No hotel found for the organization');
      hotelId = firstHotel.id;
    }

    if (dto.assignedTo) {
      const assignee = await this.prisma.user.findFirst({
        where: { id: dto.assignedTo, organizationId: orgId },
      });
      if (!assignee) throw new NotFoundException('Assignee not found');
    }

    const priority = dto.priority || TaskPriority.MEDIUM;

    const request = await this.prisma.$transaction(async (tx) => {
      const seqKey = `maintenance-${new Date().getFullYear()}`;
      const seq = await tx.sequence.upsert({
        where: { id: seqKey },
        create: { id: seqKey, value: 1 },
        update: { value: { increment: 1 } },
      });
      const year = new Date().getFullYear();
      const requestNumber = `MT-${year}-${String(seq.value - 1).padStart(4, '0')}`;

      const status = dto.assignedTo
        ? MaintenanceRequestStatus.ASSIGNED
        : MaintenanceRequestStatus.OPEN;

      const created = await tx.maintenanceRequest.create({
        data: {
          requestNumber,
          organizationId: orgId,
          hotelId: hotelId as string,
          roomId: dto.roomId || null,
          category: dto.category,
          title: dto.title,
          description: dto.description || null,
          priority,
          status,
          assignedTo: dto.assignedTo || null,
          createdBy: user.id,
          cost: dto.cost || null,
        },
      });

      if (dto.roomId) {
        const maintenanceStatus =
          priority === TaskPriority.HIGH || priority === TaskPriority.URGENT
            ? RoomMaintenanceStatus.MAJOR
            : RoomMaintenanceStatus.MINOR;
        await tx.room.update({
          where: { id: dto.roomId },
          data: { maintenanceStatus },
        });
      }

      return tx.maintenanceRequest.findUnique({
        where: { id: created.id },
        include: {
          room: { select: { id: true, roomNumber: true } },
          assignedToUser: { select: { id: true, firstName: true, lastName: true } },
        },
      });
    });

    await this.auditService.record(user.id, orgId, 'CREATE', 'MaintenanceRequest', request?.id ?? null, {
      newValue: { requestNumber: request?.requestNumber, status: request?.status },
    });

    if (dto.assignedTo) {
      await this.notificationsService.create({
        userId: dto.assignedTo,
        organizationId: orgId,
        type: 'MAINTENANCE',
        title: 'New maintenance request assigned',
        body: `${request?.title}`,
        link: `/maintenance/requests/${request?.id}`,
        relatedId: request?.id,
        relatedType: 'MaintenanceRequest',
      });
    }

    await this.notificationsService.notifyRole({
      roles: ['MAINTENANCE_MANAGER', 'GENERAL_MANAGER'],
      organizationId: orgId,
      hotelId: hotelId,
      type: 'MAINTENANCE',
      title: 'New maintenance request',
      body: `${request?.title}`,
      link: `/maintenance/requests/${request?.id}`,
      relatedId: request?.id,
      relatedType: 'MaintenanceRequest',
    });

    return request;
  }

  async update(user: AuthenticatedUser, id: string, dto: {
    title?: string;
    description?: string;
    category?: MaintenanceCategory;
    priority?: TaskPriority;
    roomId?: string;
    assignedTo?: string;
    cost?: number;
  }) {
    this.enforceManager(user);
    const existing = await this.findOne(user, id);

    if (existing.status === MaintenanceRequestStatus.RESOLVED || existing.status === MaintenanceRequestStatus.CLOSED) {
      throw new ConflictException('Cannot update a resolved or closed request');
    }

    if (dto.assignedTo) {
      const assignee = await this.prisma.user.findFirst({
        where: { id: dto.assignedTo, organizationId: user.organizationId },
      });
      if (!assignee) throw new NotFoundException('Assignee not found');
    }

    if (dto.roomId) {
      const room = await this.prisma.room.findFirst({
        where: { id: dto.roomId, organizationId: user.organizationId },
      });
      if (!room) throw new NotFoundException('Room not found');
    }

    const updated = await this.prisma.maintenanceRequest.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.category ? { category: dto.category } : {}),
        ...(dto.priority ? { priority: dto.priority } : {}),
        ...(dto.roomId ? { roomId: dto.roomId } : {}),
        ...(dto.assignedTo ? { assignedTo: dto.assignedTo } : {}),
        ...(dto.cost !== undefined ? { cost: dto.cost } : {}),
      },
    });

    await this.auditService.record(user.id, user.organizationId, 'UPDATE', 'MaintenanceRequest', id, {
      newValue: dto,
    });

    return this.findOne(user, id);
  }

  async assign(user: AuthenticatedUser, id: string, dto: { assignedTo: string }) {
    this.enforceManager(user);
    await this.findOne(user, id);

    const assignee = await this.prisma.user.findFirst({
      where: { id: dto.assignedTo, organizationId: user.organizationId },
    });
    if (!assignee) throw new NotFoundException('Assignee not found');

    const updated = await this.prisma.maintenanceRequest.update({
      where: { id },
      data: {
        assignedTo: dto.assignedTo,
        status: MaintenanceRequestStatus.ASSIGNED,
      },
    });

    await this.auditService.record(user.id, user.organizationId, 'ASSIGN', 'MaintenanceRequest', id, {
      newValue: { assignedTo: dto.assignedTo },
    });

    await this.notificationsService.create({
      userId: dto.assignedTo,
      organizationId: user.organizationId,
      type: 'MAINTENANCE',
      title: 'Maintenance request assigned to you',
      body: `${updated.title}`,
      link: `/maintenance/requests/${id}`,
      relatedId: id,
      relatedType: 'MaintenanceRequest',
    });

    return this.findOne(user, id);
  }

  async start(user: AuthenticatedUser, id: string) {
    const existing = await this.findOne(user, id);
    this.enforceStaffAssigned(user, existing.assignedTo);

    if (
      existing.status !== MaintenanceRequestStatus.ASSIGNED &&
      existing.status !== MaintenanceRequestStatus.OPEN &&
      existing.status !== MaintenanceRequestStatus.WAITING
    ) {
      throw new ConflictException('Request must be assigned, open, or waiting to start');
    }

    const updated = await this.prisma.maintenanceRequest.update({
      where: { id },
      data: { status: MaintenanceRequestStatus.IN_PROGRESS, startedAt: new Date() },
    });

    await this.auditService.record(user.id, user.organizationId, 'UPDATE', 'MaintenanceRequest', id, {
      newValue: { status: 'IN_PROGRESS' },
    });

    return this.findOne(user, id);
  }

  async resolve(user: AuthenticatedUser, id: string, dto: { cost?: number; notes?: string }) {
    const existing = await this.findOne(user, id);
    this.enforceStaffAssigned(user, existing.assignedTo);

    if (existing.status === MaintenanceRequestStatus.RESOLVED || existing.status === MaintenanceRequestStatus.CLOSED) {
      throw new ConflictException('Request is already resolved or closed');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.maintenanceRequest.update({
        where: { id },
        data: {
          status: MaintenanceRequestStatus.RESOLVED,
          resolvedAt: new Date(),
          resolvedBy: user.id,
          ...(dto.cost !== undefined ? { cost: dto.cost } : {}),
          ...(dto.notes !== undefined ? { description: dto.notes } : {}),
        },
      });

      if (existing.roomId) {
        await tx.room.update({
          where: { id: existing.roomId },
          data: { maintenanceStatus: RoomMaintenanceStatus.NONE },
        });
      }
    });

    await this.auditService.record(user.id, user.organizationId, 'RESOLVE', 'MaintenanceRequest', id, {
      newValue: { status: 'RESOLVED', ...(dto.cost !== undefined ? { cost: dto.cost } : {}) },
    });

    const updated = await this.findOne(user, id);

    await this.notificationsService.notifyRole({
      roles: ['MAINTENANCE_MANAGER', 'GENERAL_MANAGER', 'HOTEL_MANAGER'],
      organizationId: user.organizationId,
      type: 'MAINTENANCE',
      title: 'Maintenance request resolved',
      body: `${updated.title}`,
      link: `/maintenance/requests/${id}`,
      relatedId: id,
      relatedType: 'MaintenanceRequest',
    });

    return updated;
  }

  async close(user: AuthenticatedUser, id: string) {
    this.enforceManager(user);
    const existing = await this.findOne(user, id);

    if (existing.status !== MaintenanceRequestStatus.RESOLVED) {
      throw new ConflictException('Only resolved requests can be closed');
    }

    const updated = await this.prisma.maintenanceRequest.update({
      where: { id },
      data: { status: MaintenanceRequestStatus.CLOSED },
    });

    await this.auditService.record(user.id, user.organizationId, 'COMPLETE', 'MaintenanceRequest', id, {
      newValue: { status: 'CLOSED' },
    });

    return this.findOne(user, id);
  }
}