import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  HousekeepingStatus,
  HousekeepingTaskStatus,
  Prisma,
  RoomOperationalStatus,
  TaskPriority,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { startOfDay } from '../../common/utils/date.util';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

const MANAGER_ROLES = [
  'OWNER',
  'SUPER_ADMIN',
  'GENERAL_MANAGER',
  'HOTEL_MANAGER',
  'HOUSEKEEPING_MANAGER',
];

@Injectable()
export class HousekeepingService {
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

  private enforceHousekeeperOwnTask(user: AuthenticatedUser, assignedTo: string | null) {
    if (!this.isManager(user) && user.role === 'HOUSEKEEPER' && assignedTo !== user.id) {
      throw new ForbiddenException('You can only work on tasks assigned to you');
    }
  }

  async board(user: AuthenticatedUser, hotelId?: string) {
    const orgId = user.organizationId;
    const filterHotelId = hotelId || user.hotelId;

    const roomWhere: Prisma.RoomWhereInput = { organizationId: orgId };
    if (filterHotelId) roomWhere.hotelId = filterHotelId;

    const taskWhere: Prisma.HousekeepingTaskWhereInput = {
      organizationId: orgId,
      status: { not: 'CANCELLED' as HousekeepingTaskStatus },
    };
    if (filterHotelId) taskWhere.hotelId = filterHotelId;

    const [rooms, tasks] = await Promise.all([
      this.prisma.room.findMany({
        where: roomWhere,
        include: {
          roomType: { select: { name: true } },
          reservations: {
            where: { status: { in: ['CHECKED_IN', 'CHECKED_OUT', 'COMPLETED'] } },
            orderBy: { checkOutDate: 'desc' },
            take: 1,
            select: { checkOutAt: true, checkOutDate: true },
          },
        },
        orderBy: { roomNumber: 'asc' },
      }),
      this.prisma.housekeepingTask.findMany({
        where: taskWhere,
        include: {
          room: { select: { id: true, roomNumber: true, roomType: { select: { name: true } } } },
          assignedToUser: { select: { firstName: true, lastName: true } },
          inspectedByUser: { select: { firstName: true, lastName: true } },
          reservation: { select: { checkOutAt: true, checkOutDate: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const roomMap = new Map(rooms.map((r) => [r.id, r]));
    const tasksByRoom = new Map<string, typeof tasks>();
    for (const task of tasks) {
      const existing = tasksByRoom.get(task.roomId) || [];
      existing.push(task);
      tasksByRoom.set(task.roomId, existing);
    }

    const makeCard = (room: (typeof rooms)[0], task?: (typeof tasks)[0]) => {
      const res = task?.reservation || room.reservations[0];
      const checkoutTime = res?.checkOutAt || res?.checkOutDate || null;
      const baseDate = task?.createdAt || room.updatedAt;
      const elapsedMinutes = Math.floor((Date.now() - new Date(baseDate).getTime()) / 60000);
      return {
        taskId: task?.id || null,
        roomId: room.id,
        roomNumber: room.roomNumber,
        roomType: room.roomType.name,
        priority: task?.priority || null,
        assignedTo: task?.assignedToUser
          ? `${task.assignedToUser.firstName} ${task.assignedToUser.lastName}`
          : null,
        checkoutTime,
        notes: task?.notes || null,
        elapsedMinutes,
      };
    };

    const dirtyRooms = rooms.filter((r) => {
      if (r.housekeepingStatus !== HousekeepingStatus.DIRTY) return false;
      const roomTasks = tasksByRoom.get(r.id);
      if (!roomTasks || roomTasks.length === 0) return true;
      return roomTasks.every((t) => t.status === HousekeepingTaskStatus.CANCELLED);
    });
    const dirty = dirtyRooms.map((r) => makeCard(r));

    const assignedTasks = tasks.filter((t) => t.status === HousekeepingTaskStatus.ASSIGNED);
    const assigned = assignedTasks.map((t) => {
      const room = roomMap.get(t.roomId)!;
      return makeCard(room, t);
    });

    const inProgressTasks = tasks.filter((t) => t.status === HousekeepingTaskStatus.IN_PROGRESS);
    const inProgressRoomIds = new Set(inProgressTasks.map((t) => t.roomId));
    const cleaningOnlyRooms = rooms.filter(
      (r) => r.housekeepingStatus === HousekeepingStatus.CLEANING && !inProgressRoomIds.has(r.id)
    );
    const cleaning = [
      ...inProgressTasks.map((t) => makeCard(roomMap.get(t.roomId)!, t)),
      ...cleaningOnlyRooms.map((r) => makeCard(r)),
    ];

    const completedTasks = tasks.filter((t) => t.status === HousekeepingTaskStatus.COMPLETED);
    const readyForInspection = completedTasks.map((t) => makeCard(roomMap.get(t.roomId)!, t));

    const inspectedTasks = tasks.filter((t) => t.status === HousekeepingTaskStatus.INSPECTED);
    const inspected = inspectedTasks.map((t) => makeCard(roomMap.get(t.roomId)!, t));

    return {
      columns: {
        DIRTY: { items: dirty, count: dirty.length },
        ASSIGNED: { items: assigned, count: assigned.length },
        CLEANING: { items: cleaning, count: cleaning.length },
        READY_FOR_INSPECTION: { items: readyForInspection, count: readyForInspection.length },
        INSPECTED: { items: inspected, count: inspected.length },
      },
      counts: {
        dirty: dirty.length,
        assigned: assigned.length,
        cleaning: cleaning.length,
        readyForInspection: readyForInspection.length,
        inspected: inspected.length,
        total: dirty.length + assigned.length + cleaning.length + readyForInspection.length + inspected.length,
      },
    };
  }

  async findAll(
    user: AuthenticatedUser,
    query: {
      status?: HousekeepingTaskStatus;
      priority?: TaskPriority;
      assignedTo?: string;
      hotelId?: string;
      page?: number;
      pageSize?: number;
    }
  ) {
    const page = query.page || 1;
    const pageSize = Math.min(query.pageSize || 20, 100);
    const filterHotelId = query.hotelId || user.hotelId;

    const where: Prisma.HousekeepingTaskWhereInput = {
      organizationId: user.organizationId,
      ...(filterHotelId ? { hotelId: filterHotelId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.assignedTo ? { assignedTo: query.assignedTo } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.housekeepingTask.findMany({
        where,
        include: {
          room: { select: { id: true, roomNumber: true, roomType: { select: { name: true } } } },
          assignedToUser: { select: { id: true, firstName: true, lastName: true } },
          createdByUser: { select: { id: true, firstName: true, lastName: true } },
          inspectedByUser: { select: { id: true, firstName: true, lastName: true } },
          reservation: { select: { checkOutAt: true, checkOutDate: true, confirmationNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.housekeepingTask.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const task = await this.prisma.housekeepingTask.findFirst({
      where: { id, organizationId: user.organizationId },
      include: {
        room: { include: { roomType: true } },
        assignedToUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        createdByUser: { select: { id: true, firstName: true, lastName: true } },
        inspectedByUser: { select: { id: true, firstName: true, lastName: true } },
        reservation: { select: { checkOutAt: true, checkOutDate: true, confirmationNumber: true } },
      },
    });
    if (!task) throw new NotFoundException('Housekeeping task not found');
    return task;
  }

  async dashboard(user: AuthenticatedUser, hotelId?: string) {
    const orgId = user.organizationId;
    const filterHotelId = hotelId || user.hotelId;
    const today = startOfDay(new Date());
    const where: Prisma.RoomWhereInput = { organizationId: orgId };
    if (filterHotelId) where.hotelId = filterHotelId;
    const taskWhere: Prisma.HousekeepingTaskWhereInput = { organizationId: orgId };
    if (filterHotelId) taskWhere.hotelId = filterHotelId;

    const [rooms, todaysTasks, completedToday, overdueTasks] = await Promise.all([
      this.prisma.room.findMany({ where, select: { housekeepingStatus: true, status: true } }),
      this.prisma.housekeepingTask.count({ where: { ...taskWhere, createdAt: { gte: today } } }),
      this.prisma.housekeepingTask.findMany({
        where: { ...taskWhere, status: HousekeepingTaskStatus.INSPECTED, inspectedAt: { gte: today } },
        select: { startedAt: true, completedAt: true },
      }),
      this.prisma.housekeepingTask.count({
        where: {
          ...taskWhere,
          status: { in: [HousekeepingTaskStatus.PENDING, HousekeepingTaskStatus.ASSIGNED] },
          priority: { in: [TaskPriority.HIGH, TaskPriority.URGENT] },
        },
      }),
    ]);

    const dirty = rooms.filter((r) => r.housekeepingStatus === HousekeepingStatus.DIRTY).length;
    const clean = rooms.filter((r) => r.housekeepingStatus === HousekeepingStatus.CLEAN).length;
    const cleaning = rooms.filter((r) => r.housekeepingStatus === HousekeepingStatus.CLEANING).length;
    const inspected = rooms.filter((r) => r.housekeepingStatus === HousekeepingStatus.INSPECTED).length;
    const outOfService = rooms.filter((r) => r.status === RoomOperationalStatus.OUT_OF_SERVICE).length;

    let avgCleaningMinutes = 0;
    if (completedToday.length > 0) {
      const durations = completedToday
        .filter((t) => t.startedAt && t.completedAt)
        .map((t) => (new Date(t.completedAt!).getTime() - new Date(t.startedAt!).getTime()) / 60000);
      if (durations.length > 0) {
        avgCleaningMinutes = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
      }
    }

    return {
      dirty,
      clean,
      cleaning,
      inspected,
      outOfService,
      overdueTasks,
      todaysTasks,
      tasksCompletedToday: completedToday.length,
      avgCleaningMinutes,
    };
  }

  async create(user: AuthenticatedUser, dto: {
    roomId: string;
    assignedTo?: string;
    priority?: TaskPriority;
    notes?: string;
    reservationId?: string;
  }) {
    const orgId = user.organizationId;

    const room = await this.prisma.room.findFirst({
      where: { id: dto.roomId, organizationId: orgId },
    });
    if (!room) throw new NotFoundException('Room not found');

    if (dto.assignedTo) {
      const assignee = await this.prisma.user.findFirst({
        where: { id: dto.assignedTo, organizationId: orgId },
      });
      if (!assignee) throw new NotFoundException('Assignee not found');
    }

    const status = dto.assignedTo
      ? HousekeepingTaskStatus.ASSIGNED
      : HousekeepingTaskStatus.PENDING;

    const task = await this.prisma.$transaction(async (tx) => {
      const created = await tx.housekeepingTask.create({
        data: {
          organizationId: orgId,
          hotelId: room.hotelId,
          roomId: dto.roomId,
          reservationId: dto.reservationId || null,
          assignedTo: dto.assignedTo || null,
          createdBy: user.id,
          priority: dto.priority || TaskPriority.MEDIUM,
          status,
          notes: dto.notes || null,
        },
      });

      if (room.housekeepingStatus === HousekeepingStatus.CLEAN) {
        await tx.room.update({
          where: { id: dto.roomId },
          data: { housekeepingStatus: HousekeepingStatus.DIRTY },
        });
      }

      return created;
    });

    await this.auditService.record(user.id, orgId, 'CREATE', 'HousekeepingTask', task.id, {
      newValue: { roomId: dto.roomId, status, priority: task.priority },
    });

    if (dto.assignedTo) {
      await this.notificationsService.create({
        userId: dto.assignedTo,
        organizationId: orgId,
        type: 'HOUSEKEEPING',
        title: 'New task assigned to you',
        body: `Room ${room.roomNumber}${dto.notes ? ` - ${dto.notes}` : ''}`,
        link: `/housekeeping/tasks/${task.id}`,
        relatedId: task.id,
        relatedType: 'HousekeepingTask',
      });
    }

    await this.notificationsService.notifyRole({
      roles: ['HOUSEKEEPING_MANAGER'],
      organizationId: orgId,
      hotelId: room.hotelId,
      type: 'HOUSEKEEPING',
      title: 'New housekeeping task',
      body: `Room ${room.roomNumber}`,
      link: `/housekeeping/tasks/${task.id}`,
      relatedId: task.id,
      relatedType: 'HousekeepingTask',
    });

    return this.findOne(user, task.id);
  }

  async update(user: AuthenticatedUser, id: string, dto: {
    notes?: string;
    priority?: TaskPriority;
    assignedTo?: string;
  }) {
    this.enforceManager(user);
    const existing = await this.findOne(user, id);

    if (dto.assignedTo) {
      const assignee = await this.prisma.user.findFirst({
        where: { id: dto.assignedTo, organizationId: user.organizationId },
      });
      if (!assignee) throw new NotFoundException('Assignee not found');
    }

    const updated = await this.prisma.housekeepingTask.update({
      where: { id },
      data: {
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.priority ? { priority: dto.priority } : {}),
        ...(dto.assignedTo ? { assignedTo: dto.assignedTo } : {}),
      },
    });

    await this.auditService.record(user.id, user.organizationId, 'UPDATE', 'HousekeepingTask', id, {
      newValue: dto,
    });

    return this.findOne(user, id);
  }

  async assign(user: AuthenticatedUser, id: string, dto: { assignedTo: string }) {
    this.enforceManager(user);
    const existing = await this.findOne(user, id);

    const assignee = await this.prisma.user.findFirst({
      where: { id: dto.assignedTo, organizationId: user.organizationId },
    });
    if (!assignee) throw new NotFoundException('Assignee not found');

    const updated = await this.prisma.housekeepingTask.update({
      where: { id },
      data: {
        assignedTo: dto.assignedTo,
        status: HousekeepingTaskStatus.ASSIGNED,
      },
    });

    await this.auditService.record(user.id, user.organizationId, 'ASSIGN', 'HousekeepingTask', id, {
      newValue: { assignedTo: dto.assignedTo },
    });

    await this.notificationsService.create({
      userId: dto.assignedTo,
      organizationId: user.organizationId,
      type: 'HOUSEKEEPING',
      title: 'Task assigned to you',
      body: `Room ${existing.room.roomNumber}`,
      link: `/housekeeping/tasks/${id}`,
      relatedId: id,
      relatedType: 'HousekeepingTask',
    });

    return this.findOne(user, id);
  }

  async start(user: AuthenticatedUser, id: string) {
    const existing = await this.findOne(user, id);
    this.enforceHousekeeperOwnTask(user, existing.assignedTo);

    if (existing.status !== HousekeepingTaskStatus.ASSIGNED && existing.status !== HousekeepingTaskStatus.PENDING) {
      throw new ConflictException('Task must be assigned or pending to start');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.housekeepingTask.update({
        where: { id },
        data: { status: HousekeepingTaskStatus.IN_PROGRESS, startedAt: new Date() },
      });

      await tx.room.update({
        where: { id: existing.roomId },
        data: { housekeepingStatus: HousekeepingStatus.CLEANING },
      });
    });

    await this.auditService.record(user.id, user.organizationId, 'UPDATE', 'HousekeepingTask', id, {
      newValue: { status: 'IN_PROGRESS' },
    });

    return this.findOne(user, id);
  }

  async complete(user: AuthenticatedUser, id: string) {
    const existing = await this.findOne(user, id);
    this.enforceHousekeeperOwnTask(user, existing.assignedTo);

    if (existing.status !== HousekeepingTaskStatus.IN_PROGRESS) {
      throw new ConflictException('Task must be in progress to complete');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.housekeepingTask.update({
        where: { id },
        data: { status: HousekeepingTaskStatus.COMPLETED, completedAt: new Date() },
      });

      await tx.room.update({
        where: { id: existing.roomId },
        data: { housekeepingStatus: HousekeepingStatus.CLEAN },
      });
    });

    await this.auditService.record(user.id, user.organizationId, 'COMPLETE', 'HousekeepingTask', id, {
      newValue: { status: 'COMPLETED' },
    });

    return this.findOne(user, id);
  }

  async inspect(user: AuthenticatedUser, id: string) {
    this.enforceManager(user);
    const existing = await this.findOne(user, id);

    if (existing.status !== HousekeepingTaskStatus.COMPLETED) {
      throw new ConflictException('Task must be completed to inspect');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.housekeepingTask.update({
        where: { id },
        data: {
          status: HousekeepingTaskStatus.INSPECTED,
          inspectedAt: new Date(),
          inspectedBy: user.id,
        },
      });

      await tx.room.update({
        where: { id: existing.roomId },
        data: { housekeepingStatus: HousekeepingStatus.INSPECTED },
      });

      const room = await tx.room.findUnique({ where: { id: existing.roomId } });
      if (
        room &&
        room.status !== RoomOperationalStatus.OCCUPIED &&
        room.status !== RoomOperationalStatus.OUT_OF_ORDER &&
        room.status !== RoomOperationalStatus.OUT_OF_SERVICE
      ) {
        await tx.room.update({
          where: { id: existing.roomId },
          data: { status: RoomOperationalStatus.AVAILABLE },
        });
      }
    });

    await this.auditService.record(user.id, user.organizationId, 'INSPECT', 'HousekeepingTask', id, {
      newValue: { status: 'INSPECTED', inspectedBy: user.id },
    });

    await this.notificationsService.notifyRole({
      roles: ['HOUSEKEEPING_MANAGER'],
      organizationId: user.organizationId,
      type: 'HOUSEKEEPING',
      title: 'Task inspected',
      body: `Room ${existing.room.roomNumber} inspected and ready`,
      link: `/housekeeping/tasks/${id}`,
      relatedId: id,
      relatedType: 'HousekeepingTask',
    });

    return this.findOne(user, id);
  }

  async remove(user: AuthenticatedUser, id: string) {
    this.enforceManager(user);
    const existing = await this.findOne(user, id);

    if (existing.status === HousekeepingTaskStatus.INSPECTED) {
      throw new ConflictException('Cannot cancel an inspected task');
    }

    await this.prisma.housekeepingTask.update({
      where: { id },
      data: { status: HousekeepingTaskStatus.CANCELLED },
    });

    await this.auditService.record(user.id, user.organizationId, 'CANCEL', 'HousekeepingTask', id, {
      newValue: { status: 'CANCELLED' },
    });

    return { success: true };
  }

  async updateRoomStatus(user: AuthenticatedUser, roomId: string, dto: { housekeepingStatus: HousekeepingStatus }) {
    this.enforceManager(user);

    const room = await this.prisma.room.findFirst({
      where: { id: roomId, organizationId: user.organizationId },
    });
    if (!room) throw new NotFoundException('Room not found');

    const allowed: Record<string, HousekeepingStatus[]> = {
      [HousekeepingStatus.CLEAN]: [HousekeepingStatus.DIRTY],
      [HousekeepingStatus.DIRTY]: [HousekeepingStatus.CLEANING, HousekeepingStatus.OUT_OF_SERVICE],
      [HousekeepingStatus.CLEANING]: [HousekeepingStatus.CLEAN, HousekeepingStatus.INSPECTED],
      [HousekeepingStatus.INSPECTED]: [HousekeepingStatus.DIRTY],
      [HousekeepingStatus.OUT_OF_SERVICE]: [HousekeepingStatus.DIRTY],
    };

    const currentStatus = room.housekeepingStatus;
    const allowedNext = allowed[currentStatus] || [];
    if (!allowedNext.includes(dto.housekeepingStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${currentStatus} to ${dto.housekeepingStatus}`
      );
    }

    await this.prisma.room.update({
      where: { id: roomId },
      data: { housekeepingStatus: dto.housekeepingStatus },
    });

    await this.auditService.record(user.id, user.organizationId, 'UPDATE', 'Room', roomId, {
      oldValue: { housekeepingStatus: currentStatus },
      newValue: { housekeepingStatus: dto.housekeepingStatus },
    });

    return this.prisma.room.findUnique({
      where: { id: roomId },
      select: { id: true, roomNumber: true, housekeepingStatus: true },
    });
  }
}
