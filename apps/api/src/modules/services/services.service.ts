import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityType,
  FolioEntryType,
  Prisma,
  ServiceOrderStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { roundAmount } from '../../common/utils/money.util';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

const CATALOG_WRITE_ROLES = [
  'OWNER',
  'SUPER_ADMIN',
  'GENERAL_MANAGER',
  'HOTEL_MANAGER',
];

const ORDER_CREATE_ROLES = [
  'OWNER',
  'SUPER_ADMIN',
  'GENERAL_MANAGER',
  'HOTEL_MANAGER',
  'FRONT_DESK',
];

@Injectable()
export class ServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService
  ) {}

  private enforceCatalogWrite(user: AuthenticatedUser) {
    if (!CATALOG_WRITE_ROLES.includes(user.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }

  private enforceOrderCreate(user: AuthenticatedUser) {
    if (!ORDER_CREATE_ROLES.includes(user.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }

  async findServices(
    user: AuthenticatedUser,
    query: {
      category?: string;
      active?: boolean;
      hotelId?: string;
      page?: number;
      pageSize?: number;
    }
  ) {
    const page = query.page || 1;
    const pageSize = Math.min(query.pageSize || 20, 100);

    const where: Prisma.HotelServiceWhereInput = {
      organizationId: user.organizationId,
      ...(query.active !== undefined ? { active: query.active } : {}),
      ...(query.category ? { category: query.category } : {}),
    };
    if (query.hotelId || user.hotelId) {
      const hotelId = query.hotelId || user.hotelId as string;
      where.OR = [{ hotelId }, { hotelId: null }];
    }

    const [items, total] = await Promise.all([
      this.prisma.hotelService.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.hotelService.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async createService(user: AuthenticatedUser, dto: {
    name: string;
    description?: string;
    price: number;
    taxRate?: number;
    category?: string;
    active?: boolean;
    image?: string;
  }) {
    this.enforceCatalogWrite(user);
    const orgId = user.organizationId;

    const service = await this.prisma.hotelService.create({
      data: {
        organizationId: orgId,
        hotelId: user.hotelId,
        name: dto.name,
        description: dto.description || null,
        price: dto.price,
        taxRate: dto.taxRate || 0,
        category: dto.category || null,
        active: dto.active ?? true,
        image: dto.image || null,
      },
    });

    await this.auditService.record(user.id, orgId, 'CREATE', 'HotelService', service.id, {
      newValue: { name: service.name, price: service.price },
    });

    return service;
  }

  async updateService(user: AuthenticatedUser, id: string, dto: {
    name?: string;
    description?: string;
    price?: number;
    taxRate?: number;
    category?: string;
    active?: boolean;
    image?: string;
  }) {
    this.enforceCatalogWrite(user);

    const existing = await this.prisma.hotelService.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) throw new NotFoundException('Service not found');

    const updated = await this.prisma.hotelService.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.taxRate !== undefined ? { taxRate: dto.taxRate } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        ...(dto.image !== undefined ? { image: dto.image } : {}),
      },
    });

    await this.auditService.record(user.id, user.organizationId, 'UPDATE', 'HotelService', id, {
      newValue: dto,
    });

    return updated;
  }

  async deleteService(user: AuthenticatedUser, id: string) {
    this.enforceCatalogWrite(user);

    const existing = await this.prisma.hotelService.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) throw new NotFoundException('Service not found');

    const updated = await this.prisma.hotelService.update({
      where: { id },
      data: { active: false },
    });

    await this.auditService.record(user.id, user.organizationId, 'DELETE', 'HotelService', id, {
      newValue: { active: false },
    });

    return updated;
  }

  async findOrders(
    user: AuthenticatedUser,
    query: {
      reservationId?: string;
      status?: ServiceOrderStatus;
      hotelId?: string;
      page?: number;
      pageSize?: number;
    }
  ) {
    const page = query.page || 1;
    const pageSize = Math.min(query.pageSize || 20, 100);
    const filterHotelId = query.hotelId || user.hotelId;

    const where: Prisma.ServiceOrderWhereInput = {
      organizationId: user.organizationId,
      ...(filterHotelId ? { hotelId: filterHotelId } : {}),
      ...(query.reservationId ? { reservationId: query.reservationId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.serviceOrder.findMany({
        where,
        include: {
          service: { select: { id: true, name: true, category: true } },
          reservation: { select: { id: true, confirmationNumber: true, guest: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.serviceOrder.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async findOrder(user: AuthenticatedUser, id: string) {
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id, organizationId: user.organizationId },
      include: {
        service: true,
        reservation: {
          include: {
            guest: true,
            room: { select: { id: true, roomNumber: true } },
            folio: { include: { entries: { orderBy: { createdAt: 'asc' } } } },
          },
        },
        createdByUser: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!order) throw new NotFoundException('Service order not found');
    return order;
  }

  async createOrder(user: AuthenticatedUser, dto: {
    reservationId: string;
    serviceId: string;
    quantity?: number;
    notes?: string;
    requestedTime?: string;
  }) {
    this.enforceOrderCreate(user);
    const orgId = user.organizationId;

    const order = await this.prisma.$transaction(async (tx) => {
      const service = await tx.hotelService.findFirst({
        where: { id: dto.serviceId, organizationId: orgId },
      });
      if (!service) throw new NotFoundException('Service not found');
      if (service.active === false) throw new BadRequestException('Service is inactive');

      const reservation = await tx.reservation.findFirst({
        where: { id: dto.reservationId, organizationId: orgId },
        include: { folio: true },
      });
      if (!reservation) throw new NotFoundException('Reservation not found');

      const quantity = dto.quantity || 1;
      const unitPrice = Number(service.price);
      const taxRate = Number(service.taxRate);
      const taxAmount = roundAmount((unitPrice * quantity * taxRate) / 100);
      const total = roundAmount(unitPrice * quantity + taxAmount);

      const requestedAt = dto.requestedTime ? new Date(dto.requestedTime) : null;
      const isFuture = !!requestedAt && requestedAt.getTime() > Date.now();

      const created = await tx.serviceOrder.create({
        data: {
          organizationId: orgId,
          hotelId: reservation.hotelId,
          reservationId: reservation.id,
          guestId: reservation.guestId,
          serviceId: service.id,
          quantity,
          unitPrice,
          taxAmount,
          total,
          status: isFuture ? ServiceOrderStatus.ORDERED : ServiceOrderStatus.DELIVERED,
          requestedTime: requestedAt,
          deliveredTime: isFuture ? null : new Date(),
          notes: dto.notes || null,
          createdBy: user.id,
        },
      });

      if (reservation.folio) {
        await tx.folioEntry.create({
          data: {
            folioId: reservation.folio.id,
            reservationId: reservation.id,
            type: FolioEntryType.SERVICE,
            description: `Service: ${service.name}`,
            amount: roundAmount(unitPrice * quantity),
            taxAmount,
            quantity,
            referenceId: created.id,
            referenceType: 'ServiceOrder',
            createdBy: user.id,
          },
        });

        await tx.folio.update({
          where: { id: reservation.folio.id },
          data: { balance: { increment: total } },
        });
      }

      await tx.reservationActivity.create({
        data: {
          reservationId: reservation.id,
          type: ActivityType.SERVICE_ORDERED,
          description: `Service ordered: ${service.name} x${quantity}`,
          performedBy: user.id,
        },
      });

      return created;
    });

    await this.auditService.record(user.id, orgId, 'CREATE', 'ServiceOrder', order.id, {
      newValue: { serviceId: order.serviceId, quantity: order.quantity, total: order.total },
    });

    const service = await this.prisma.hotelService.findUnique({
      where: { id: order.serviceId },
      select: { name: true },
    });

    await this.notificationsService.notifyRole({
      roles: ['FRONT_DESK', 'GENERAL_MANAGER', 'HOTEL_MANAGER'],
      organizationId: orgId,
      hotelId: user.hotelId,
      type: 'SERVICE',
      title: 'New service order',
      body: `${service?.name} x${order.quantity}`,
      link: `/service-orders/${order.id}`,
      relatedId: order.id,
      relatedType: 'ServiceOrder',
    });

    return this.findOrder(user, order.id);
  }

  async cancelOrder(user: AuthenticatedUser, id: string) {
    this.enforceOrderCreate(user);

    const existing = await this.prisma.serviceOrder.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) throw new NotFoundException('Service order not found');
    if (existing.status === ServiceOrderStatus.CANCELLED) {
      throw new ConflictException('Service order is already cancelled');
    }
    if (existing.status === ServiceOrderStatus.COMPLETED) {
      throw new ConflictException('Cannot cancel a completed service order');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.serviceOrder.update({
        where: { id },
        data: { status: ServiceOrderStatus.CANCELLED },
      });

      const existingEntry = await tx.folioEntry.findFirst({
        where: { referenceId: id, referenceType: 'ServiceOrder' },
      });

      if (existingEntry) {
        const amount = Number(existingEntry.amount);
        const taxAmount = Number(existingEntry.taxAmount);
        const referenceEntry = await tx.folioEntry.findFirst({
          where: { referenceId: id, referenceType: 'ServiceOrder', type: FolioEntryType.ADJUSTMENT },
        });
        if (!referenceEntry) {
          await tx.folioEntry.create({
            data: {
              folioId: existingEntry.folioId,
              reservationId: existing.reservationId,
              type: FolioEntryType.ADJUSTMENT,
              description: `Cancelled: ${existingEntry.description}`,
              amount: -amount,
              taxAmount: -taxAmount,
              quantity: existing.quantity,
              referenceId: id,
              referenceType: 'ServiceOrder',
              createdBy: user.id,
            },
          });

          await tx.folio.update({
            where: { id: existingEntry.folioId },
            data: { balance: { decrement: roundAmount(amount + taxAmount) } },
          });
        }
      }
    });

    await this.auditService.record(user.id, user.organizationId, 'CANCEL', 'ServiceOrder', id, {
      newValue: { status: 'CANCELLED' },
    });

    return this.findOrder(user, id);
  }
}