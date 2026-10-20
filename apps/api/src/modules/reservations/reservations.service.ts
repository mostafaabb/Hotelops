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
  ReservationStatus,
  RoomOperationalStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AvailabilityService } from '../../availability/availability.service';
import { PricingService } from '../../pricing/pricing.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  isDateRangeValid,
  nightsBetween,
  startOfDay,
  endOfDay,
} from '../../common/utils/date.util';
import { roundAmount } from '../../common/utils/money.util';
import { generateConfirmationNumber } from '../../common/utils/id.util';
import {
  AssignRoomDto,
  CancelReservationDto,
  ChangeRoomDto,
  CreateReservationDto,
  UpdateReservationDto,
  WalkInDto,
} from './dto/reservation.dto';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

const ACTIVE_STATUSES: ReservationStatus[] = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
  ReservationStatus.INQUIRY,
];

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingService: PricingService,
    private readonly availabilityService: AvailabilityService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService
  ) {}

  async create(user: AuthenticatedUser, dto: CreateReservationDto) {
    const orgId = user.organizationId;
    const hotelId = dto.roomId
      ? (await this.getRoomHotel(dto.roomId))
      : user.hotelId || (await this.defaultHotel(orgId));

    const checkIn = startOfDay(dto.checkInDate);
    const checkOut = startOfDay(dto.checkOutDate);

    await this.validateDateRange(checkIn, checkOut);

    const guest = await this.verifyGuest(orgId, dto.guestId);
    const roomType = await this.verifyRoomType(orgId, dto.roomTypeId);
    const adults = dto.adults ?? 1;
    const children = dto.children ?? 0;
    const totalGuests = adults + children;

    await this.validateGuestCount(roomType.adultsCapacity, roomType.childrenCapacity, adults, children);

    let pricing = await this.pricingService.calculate({
      roomTypeId: dto.roomTypeId,
      ratePlanId: dto.ratePlanId,
      checkIn,
      checkOut,
      organizationId: orgId,
      hotelId,
      promoCode: dto.promoCode,
    });

    // Room assignment validation inside a transaction with advisory lock
    const reservation = await this.prisma.$transaction(async (tx) => {
      let roomId: string | null = null;
      if (dto.roomId) {
        await this.availabilityService.lockRoom(tx, dto.roomId);
        const room = await tx.room.findUnique({ where: { id: dto.roomId } });
        if (!room) throw new NotFoundException('Room not found');
        if (
          room.status === RoomOperationalStatus.OUT_OF_ORDER ||
          room.status === RoomOperationalStatus.OUT_OF_SERVICE
        ) {
          throw new ConflictException('Room is out of order or out of service');
        }
        const conflict = await tx.reservation.findFirst({
          where: {
            roomId, // eslint-disable-line @typescript-eslint/no-use-before-define
            status: { in: ACTIVE_STATUSES },
            checkInDate: { lt: checkOut },
            checkOutDate: { gt: checkIn },
          },
          select: { id: true },
        });
        if (conflict) {
          throw new ConflictException('Room is already booked for the selected dates');
        }
        roomId = dto.roomId;
        // Room may be dirty but must not be blocked
        const block = await tx.roomBlock.findFirst({
          where: {
            roomId,
            startDate: { lte: checkOut },
            OR: [{ endDate: null }, { endDate: { gte: checkIn } }],
          },
          select: { id: true },
        });
        if (block) throw new ConflictException('Room is blocked for the selected dates');
      }

      if (dto.promoCode) {
        await tx.promoCode.updateMany({
          where: { code: dto.promoCode, organizationId: orgId },
          data: { usageCount: { increment: 1 } },
        });
      }

      // Generate unique confirmation number
      const seqKey = `reservation-${new Date().getFullYear()}`;
      const seq = await tx.sequence.upsert({
        where: { id: seqKey },
        create: { id: seqKey, value: 1 },
        update: { value: { increment: 1 } },
      });
      const year = new Date().getFullYear();
      const confirmationNumber = generateConfirmationNumber(seq.value - 1, year);

      const created = await tx.reservation.create({
        data: {
          confirmationNumber,
          organizationId: orgId,
          hotelId,
          guestId: guest.id,
          roomId,
          roomTypeId: dto.roomTypeId,
          ratePlanId: dto.ratePlanId,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          adults,
          children,
          numberOfGuests: totalGuests,
          source: dto.source ?? ('DIRECT' as any),
          channel: dto.channel,
          specialRequests: dto.specialRequests,
          notes: dto.notes,
          createdBy: user.id,
          subtotal: pricing.subtotal,
          taxes: pricing.taxes,
          discounts: pricing.discounts,
          total: pricing.total,
          amountPaid: 0,
          balance: pricing.total,
          status: ReservationStatus.CONFIRMED,
        },
      });

      // Create financial folio
      const folio = await tx.folio.create({
        data: {
          reservationId: created.id,
          hotelId,
          guestId: guest.id,
          balance: pricing.total,
          paidAmount: 0,
        },
      });

      // Add room charge entries
      await tx.folioEntry.create({
        data: {
          folioId: folio.id,
          reservationId: created.id,
          type: FolioEntryType.ROOM_CHARGE,
          description: `Room charge: ${nightsBetween(checkIn, checkOut)} night(s)`,
          amount: pricing.subtotal,
          quantity: nightsBetween(checkIn, checkOut),
          createdBy: user.id,
        },
      });
      if (pricing.taxes > 0) {
        await tx.folioEntry.create({
          data: {
            folioId: folio.id,
            reservationId: created.id,
            type: FolioEntryType.TAX,
            description: 'Taxes',
            amount: pricing.taxes,
            createdBy: user.id,
          },
        });
      }
      if (pricing.discounts > 0) {
        await tx.folioEntry.create({
          data: {
            folioId: folio.id,
            reservationId: created.id,
            type: FolioEntryType.DISCOUNT,
            description: 'Promo discount',
            amount: -pricing.discounts,
            createdBy: user.id,
          },
        });
      }

      await tx.reservationActivity.create({
        data: {
          reservationId: created.id,
          type: ActivityType.CREATED,
          description: `Reservation ${confirmationNumber} created for ${guest.firstName} ${guest.lastName}`,
          performedBy: user.id,
        },
      });

      if (roomId) {
        await tx.roomAssignment.create({
          data: { reservationId: created.id, roomId, assignedBy: user.id },
        });
        await tx.reservationActivity.create({
          data: {
            reservationId: created.id,
            type: ActivityType.ROOM_ASSIGNED,
            description: `Room ${(await tx.room.findUnique({ where: { id: roomId } }))?.roomNumber} assigned`,
            performedBy: user.id,
          },
        });
      }

      return tx.reservation.findUnique({
        where: { id: created.id },
        include: {
          guest: true,
          room: { include: { roomType: true } },
          roomType: true,
          folio: { include: { entries: true, payments: true } },
        },
      });
    });

    await this.auditService.record(user.id, orgId, 'CREATE', 'Reservation', reservation?.id ?? null, {
      newValue: { confirmationNumber: reservation?.confirmationNumber, status: reservation?.status },
    });

    await this.notificationsService.create({
      userId: user.id,
      organizationId: orgId,
      type: 'RESERVATION',
      title: `Reservation ${reservation?.confirmationNumber} created`,
      body: `${guest.firstName} ${guest.lastName} · ${nightsBetween(checkIn, checkOut)} night(s)`,
      link: `/reservations/${reservation?.confirmationNumber}`,
      relatedId: reservation?.id,
      relatedType: 'Reservation',
    });

    return reservation;
  }

  async findAll(
    user: AuthenticatedUser,
    query: {
      status?: ReservationStatus;
      from?: string;
      to?: string;
      search?: string;
      page?: number;
      pageSize?: number;
      hotelId?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    }
  ) {
    const page = query.page || 1;
    const pageSize = Math.min(query.pageSize || 20, 100);
    const where: Prisma.ReservationWhereInput = {
      organizationId: user.organizationId,
      ...(query.hotelId ? { hotelId: query.hotelId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    if (query.search) {
      const term = query.search.toLowerCase();
      where.OR = [
        { confirmationNumber: { contains: term, mode: 'insensitive' } },
        { guest: { firstName: { contains: term, mode: 'insensitive' } } },
        { guest: { lastName: { contains: term, mode: 'insensitive' } } },
        { guest: { email: { contains: term, mode: 'insensitive' } } },
        { guest: { phone: { contains: term, mode: 'insensitive' } } },
        { room: { roomNumber: { contains: term, mode: 'insensitive' } } },
      ];
    }

    if (query.from || query.to) {
      const ci = query.from ? startOfDay(query.from) : new Date(0);
      const co = query.to ? endOfDay(query.to) : new Date(8640000000000000);
      where.checkInDate = { lte: co };
      where.checkOutDate = { gte: ci };
    }

    const [items, total] = await Promise.all([
      this.prisma.reservation.findMany({
        where,
        include: {
          guest: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, isVip: true } },
          room: { select: { id: true, roomNumber: true } },
          roomType: { select: { id: true, name: true, code: true } },
          folio: { select: { balance: true, paidAmount: true } },
        },
        orderBy: query.sortBy
          ? { [query.sortBy]: query.sortOrder || 'desc' }
          : { checkInDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.reservation.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async findOne(user: AuthenticatedUser, confirmationNumberOrId: string) {
    const where =
      /^HTL-\d{4}-/.test(confirmationNumberOrId)
        ? { confirmationNumber: confirmationNumberOrId }
        : { id: confirmationNumberOrId };

    const reservation = await this.prisma.reservation.findFirst({
      where: { ...where, organizationId: user.organizationId },
      include: {
        guest: true,
        hotel: { select: { id: true, name: true, currency: true, checkInTime: true, checkOutTime: true } },
        room: { include: { roomType: true } },
        roomType: true,
        ratePlan: true,
        folio: {
          include: {
            entries: {
              orderBy: { createdAt: 'asc' },
              include: { createdByUser: { select: { id: true, firstName: true, lastName: true } } },
            },
            payments: {
              orderBy: { createdAt: 'asc' },
              include: { receivedByUser: { select: { id: true, firstName: true, lastName: true } } },
            },
          },
        },
        payments: true,
        serviceOrders: {
          include: { service: true },
          orderBy: { createdAt: 'desc' },
        },
        roomAssignments: { orderBy: { assignedAt: 'desc' } },
        roomChangeLogs: {
          include: { fromRoom: true, toRoom: true },
          orderBy: { changedAt: 'desc' },
        },
        activities: {
          include: { performedByUser: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { performedAt: 'desc' },
        },
        invoices: true,
      },
    });

    if (!reservation) throw new NotFoundException('Reservation not found');
    return reservation;
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateReservationDto) {
    const existing = await this.verifyReservation(user, id);

    if (
      existing.status === ReservationStatus.CHECKED_IN ||
      existing.status === ReservationStatus.CHECKED_OUT ||
      existing.status === ReservationStatus.COMPLETED
    ) {
      throw new BadRequestException('Cannot update a reservation that is already checked in/out');
    }

    const checkIn = dto.checkInDate ? startOfDay(dto.checkInDate) : existing.checkInDate;
    const checkOut = dto.checkOutDate ? startOfDay(dto.checkOutDate) : existing.checkOutDate;
    await this.validateDateRange(checkIn, checkOut);

    let pricing = null;
    if (dto.checkInDate || dto.checkOutDate || dto.ratePlanId || dto.roomTypeId) {
      const roomTypeId = dto.roomTypeId || existing.roomTypeId;
      if (!roomTypeId) {
        throw new BadRequestException('Room type is required for pricing');
      }
      pricing = await this.pricingService.calculate({
        roomTypeId,
        ratePlanId: dto.ratePlanId || existing.ratePlanId || undefined,
        checkIn,
        checkOut,
        organizationId: user.organizationId,
        hotelId: existing.hotelId,
      });
    }

    const oldValues = {
      checkInDate: existing.checkInDate,
      checkOutDate: existing.checkOutDate,
      roomTypeId: existing.roomTypeId,
      status: existing.status,
    };

    const updated = await this.prisma.$transaction(async (tx) => {
      const data: Prisma.ReservationUpdateInput = {
        checkInDate: checkIn,
        checkOutDate: checkOut,
        ...(dto.guestId ? { guest: { connect: { id: dto.guestId } } } : {}),
        ...(dto.adults !== undefined ? { adults: dto.adults } : {}),
        ...(dto.children !== undefined ? { children: dto.children } : {}),
        ...(dto.adults !== undefined || dto.children !== undefined
          ? { numberOfGuests: (dto.adults ?? existing.adults) + (dto.children ?? existing.children) }
          : {}),
        ...(dto.roomTypeId ? { roomType: { connect: { id: dto.roomTypeId } } } : {}),
        ...(dto.ratePlanId ? { ratePlan: { connect: { id: dto.ratePlanId } } } : {}),
        ...(dto.source ? { source: dto.source } : {}),
        ...(dto.channel !== undefined ? { channel: dto.channel } : {}),
        ...(dto.specialRequests !== undefined ? { specialRequests: dto.specialRequests } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      };

      if (pricing) {
        data.subtotal = pricing.subtotal;
        data.taxes = pricing.taxes;
        data.discounts = pricing.discounts;
        data.total = pricing.total;
        data.balance = roundAmount(pricing.total - Number(existing.amountPaid));
      }

      const result = await tx.reservation.update({
        where: { id },
        data,
      });

      await tx.reservationActivity.create({
        data: {
          reservationId: id,
          type: ActivityType.UPDATED,
          description: 'Reservation details updated',
          performedBy: user.id,
        },
      });

      return result;
    });

    await this.auditService.record(user.id, user.organizationId, 'UPDATE', 'Reservation', id, {
      oldValue: oldValues,
      newValue: { checkInDate: checkIn, checkOutDate: checkOut, status: updated.status },
    });

    return this.findOne(user, id);
  }

  async assignRoom(user: AuthenticatedUser, id: string, dto: AssignRoomDto) {
    const reservation = await this.verifyReservation(user, id);

    if (
      reservation.status !== ReservationStatus.CONFIRMED &&
      reservation.status !== ReservationStatus.INQUIRY &&
      reservation.status !== ReservationStatus.CHECKED_IN
    ) {
      throw new BadRequestException(`Cannot assign room to a ${reservation.status} reservation`);
    }

    const checkIn = startOfDay(reservation.checkInDate);
    const checkOut = startOfDay(reservation.checkOutDate);

    const result = await this.prisma.$transaction(async (tx) => {
      await this.availabilityService.lockRoom(tx, dto.roomId);
      const room = await tx.room.findUnique({ where: { id: dto.roomId } });
      if (!room) throw new NotFoundException('Room not found');
      if (
        room.status === RoomOperationalStatus.OUT_OF_ORDER ||
        room.status === RoomOperationalStatus.OUT_OF_SERVICE
      ) {
        throw new ConflictException('Room is out of order or out of service');
      }

      const conflict = await tx.reservation.findFirst({
        where: {
          roomId: dto.roomId,
          id: { not: id },
          status: { in: ACTIVE_STATUSES },
          checkInDate: { lt: checkOut },
          checkOutDate: { gt: checkIn },
        },
        select: { id: true },
      });
      if (conflict) throw new ConflictException('Room is already booked for the selected dates');

      const updated = await tx.reservation.update({
        where: { id },
        data: { roomId: dto.roomId },
      });

      await tx.roomAssignment.create({
        data: { reservationId: id, roomId: dto.roomId, assignedBy: user.id },
      });

      await tx.reservationActivity.create({
        data: {
          reservationId: id,
          type: ActivityType.ROOM_ASSIGNED,
          description: `Room ${room.roomNumber} assigned`,
          performedBy: user.id,
        },
      });

      return { updated, roomNumber: room.roomNumber };
    });

    await this.auditService.record(user.id, user.organizationId, 'ASSIGN', 'Reservation', id, {
      newValue: { roomId: dto.roomId },
    });

    return this.findOne(user, id);
  }

  async changeRoom(user: AuthenticatedUser, id: string, dto: ChangeRoomDto) {
    const reservation = await this.verifyReservation(user, id);
    if (!reservation.roomId) {
      throw new BadRequestException('Reservation has no assigned room to change from');
    }

    const checkIn = startOfDay(reservation.checkInDate);
    const checkOut = startOfDay(reservation.checkOutDate);

    const result = await this.prisma.$transaction(async (tx) => {
      await this.availabilityService.lockRoom(tx, dto.toRoomId);

      const toRoom = await tx.room.findUnique({ where: { id: dto.toRoomId } });
      if (!toRoom) throw new NotFoundException('Room not found');
      if (
        toRoom.status === RoomOperationalStatus.OUT_OF_ORDER ||
        toRoom.status === RoomOperationalStatus.OUT_OF_SERVICE
      ) {
        throw new ConflictException('Target room is out of order or out of service');
      }

      const conflict = await tx.reservation.findFirst({
        where: {
          roomId: dto.toRoomId,
          id: { not: id },
          status: { in: ACTIVE_STATUSES },
          checkInDate: { lt: checkOut },
          checkOutDate: { gt: checkIn },
        },
        select: { id: true },
      });
      if (conflict) throw new ConflictException('Target room is already booked for the selected dates');

      const fromRoom = await tx.room.findUnique({ where: { id: reservation.roomId! } });

      await tx.roomChangeLog.create({
        data: {
          reservationId: id,
          fromRoomId: reservation.roomId!,
          toRoomId: dto.toRoomId,
          reason: dto.reason,
          changedBy: user.id,
        },
      });

      await tx.reservation.update({
        where: { id },
        data: { roomId: dto.toRoomId },
      });

      await tx.reservationActivity.create({
        data: {
          reservationId: id,
          type: ActivityType.ROOM_CHANGED,
          description: `Room changed from ${fromRoom?.roomNumber} to ${toRoom.roomNumber}${
            dto.reason ? ` (${dto.reason})` : ''
          }`,
          performedBy: user.id,
        },
      });

      return { fromRoom: fromRoom?.roomNumber, toRoom: toRoom.roomNumber };
    });

    await this.auditService.record(user.id, user.organizationId, 'CHANGE', 'Reservation', id, {
      newValue: { changedRoomTo: dto.toRoomId, reason: dto.reason },
    });

    return this.findOne(user, id);
  }

  async cancel(user: AuthenticatedUser, id: string, dto: CancelReservationDto) {
    const reservation = await this.verifyReservation(user, id);

    if (
      reservation.status === ReservationStatus.CANCELLED ||
      reservation.status === ReservationStatus.CHECKED_OUT ||
      reservation.status === ReservationStatus.COMPLETED
    ) {
      throw new BadRequestException(`Cannot cancel a ${reservation.status} reservation`);
    }

    const cancelPolicy = reservation.ratePlan?.cancellationPolicy;
    const refundAmount = Number(
      dto.refund ? reservation.amountPaid : roundAmount(Number(reservation.amountPaid) * 0)
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.reservation.update({
        where: { id },
        data: {
          status: ReservationStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: dto.reason,
          balance: 0,
        },
      });

      await tx.reservationActivity.create({
        data: {
          reservationId: id,
          type: ActivityType.CANCELLED,
          description: `Reservation cancelled${dto.reason ? `: ${dto.reason}` : ''}`,
          performedBy: user.id,
        },
      });

      const folio = await tx.folio.findUnique({ where: { reservationId: id } });
      if (folio && refundAmount > 0) {
        await tx.folioEntry.create({
          data: {
            folioId: folio.id,
            reservationId: id,
            type: FolioEntryType.REFUND,
            description: 'Cancellation refund',
            amount: -refundAmount,
            createdBy: user.id,
          },
        });
        await tx.folio.update({
          where: { id: folio.id },
          data: { refundedAmount: { increment: refundAmount }, balance: 0 },
        });
      }

      return result;
    });

    await this.auditService.record(user.id, user.organizationId, 'CANCEL', 'Reservation', id, {
      newValue: { status: 'CANCELLED', reason: dto.reason, cancelPolicy },
    });

    await this.notificationsService.notifyRole({
      roles: ['FRONT_DESK', 'GENERAL_MANAGER', 'HOTEL_MANAGER'],
      organizationId: user.organizationId,
      hotelId: user.hotelId,
      type: 'RESERVATION',
      title: `Reservation ${reservation.confirmationNumber} cancelled`,
      body: `${reservation.guest?.firstName} ${reservation.guest?.lastName}`,
      link: `/reservations/${reservation.confirmationNumber}`,
      relatedId: id,
      relatedType: 'Reservation',
    });

    return this.findOne(user, id);
  }

  async addNote(user: AuthenticatedUser, id: string, note: string, type: ActivityType = ActivityType.NOTE_ADDED) {
    await this.verifyReservation(user, id);
    return this.prisma.reservationActivity.create({
      data: {
        reservationId: id,
        type,
        description: note,
        performedBy: user.id,
      },
    });
  }

  async walkIn(user: AuthenticatedUser, dto: WalkInDto) {
    const orgId = user.organizationId;
    const checkIn = startOfDay(dto.checkInDate);
    const checkOut = startOfDay(dto.checkOutDate);
    await this.validateDateRange(checkIn, checkOut);

    const available = await this.availabilityService.isRoomAvailable(dto.roomId, checkIn, checkOut);
    if (!available) {
      throw new ConflictException('Room is not available for the selected dates');
    }

    const room = await this.prisma.room.findUnique({ where: { id: dto.roomId }, include: { roomType: true } });
    if (!room) throw new NotFoundException('Room not found');

    const roomTypeId = dto.roomTypeId || room.roomTypeId;

    const adults = dto.adults ?? 1;
    const children = dto.children ?? 0;
    await this.validateGuestCount(room.roomType.adultsCapacity, room.roomType.childrenCapacity, adults, children);

    // Find or create guest
    let guestId = dto.guestId;
    if (!guestId) {
      if (dto.email) {
        const existing = await this.prisma.guest.findFirst({
          where: { organizationId: orgId, email: dto.email },
          select: { id: true },
        });
        if (existing) {
          guestId = existing.id;
        }
      }
      if (!guestId) {
        const created = await this.prisma.guest.create({
          data: {
            organizationId: orgId,
            hotelId: user.hotelId,
            firstName: dto.firstName,
            lastName: dto.lastName,
            email: dto.email,
            phone: dto.phone,
          },
        });
        guestId = created.id;
      }
    }

    const pricing = await this.pricingService.calculate({
      roomTypeId,
      ratePlanId: dto.ratePlanId,
      checkIn,
      checkOut,
      organizationId: orgId,
      hotelId: room.hotelId,
    });

    const reservation = await this.prisma.$transaction(async (tx) => {
      await this.availabilityService.lockRoom(tx, dto.roomId);

      const seqKey = `reservation-${new Date().getFullYear()}`;
      const seq = await tx.sequence.upsert({
        where: { id: seqKey },
        create: { id: seqKey, value: 1 },
        update: { value: { increment: 1 } },
      });
      const confirmationNumber = generateConfirmationNumber(seq.value - 1, new Date().getFullYear());

      const created = await tx.reservation.create({
        data: {
          confirmationNumber,
          organizationId: orgId,
          hotelId: room.hotelId,
          guestId,
          roomId: dto.roomId,
          roomTypeId,
          ratePlanId: dto.ratePlanId,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          adults,
          children,
          numberOfGuests: adults + children,
          source: 'WALK_IN' as any,
          createdBy: user.id,
          subtotal: pricing.subtotal,
          taxes: pricing.taxes,
          discounts: pricing.discounts,
          total: pricing.total,
          balance: pricing.total,
          status: ReservationStatus.CONFIRMED,
        },
      });

      const folio = await tx.folio.create({
        data: { reservationId: created.id, hotelId: room.hotelId, guestId, balance: pricing.total },
      });

      await tx.folioEntry.create({
        data: {
          folioId: folio.id,
          reservationId: created.id,
          type: FolioEntryType.ROOM_CHARGE,
          description: `Room charge: ${nightsBetween(checkIn, checkOut)} night(s)`,
          amount: pricing.subtotal,
          quantity: nightsBetween(checkIn, checkOut),
          createdBy: user.id,
        },
      });

      await tx.reservationActivity.create({
        data: {
          reservationId: created.id,
          type: ActivityType.CREATED,
          description: 'Walk-in reservation created',
          performedBy: user.id,
        },
      });

      return tx.reservation.findUnique({
        where: { id: created.id },
        include: { guest: true, room: { include: { roomType: true } }, folio: { include: { entries: true } } },
      });
    });

    await this.auditService.record(user.id, orgId, 'CREATE', 'Reservation', reservation?.id ?? null, {
      newValue: { confirmationNumber: reservation?.confirmationNumber, source: 'WALK_IN' },
    });

    return reservation;
  }

  async calendar(user: AuthenticatedUser, query: { month?: string; year?: string; hotelId?: string }) {
    const year = Number(query.year || new Date().getFullYear());
    const month = Number(query.month || new Date().getMonth() + 1);
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 1);
    const hotelId = query.hotelId || user.hotelId || (await this.defaultHotel(user.organizationId));

    const reservations = await this.prisma.reservation.findMany({
      where: {
        organizationId: user.organizationId,
        hotelId,
        status: { in: [...ACTIVE_STATUSES, ReservationStatus.CHECKED_OUT, ReservationStatus.COMPLETED] },
        checkInDate: { lt: to },
        checkOutDate: { gt: from },
      },
      include: {
        guest: { select: { firstName: true, lastName: true } },
        room: { select: { id: true, roomNumber: true, floor: { select: { number: true } } } },
      },
    });

    const rooms = await this.prisma.room.findMany({
      where: { organizationId: user.organizationId, hotelId },
      select: { id: true, roomNumber: true, status: true, floor: { select: { number: true } } },
      orderBy: { roomNumber: 'asc' },
    });

    return {
      year,
      month,
      from,
      to,
      rooms,
      reservations: reservations.map((r) => ({
        id: r.id,
        confirmationNumber: r.confirmationNumber,
        roomId: r.roomId,
        guestName: `${r.guest.firstName} ${r.guest.lastName}`,
        checkInDate: r.checkInDate,
        checkOutDate: r.checkOutDate,
        status: r.status,
        adults: r.adults,
        children: r.children,
      })),
    };
  }

  // ============ Validation helpers ============

  private async verifyGuest(orgId: string, guestId: string) {
    const guest = await this.prisma.guest.findFirst({
      where: { id: guestId, organizationId: orgId },
    });
    if (!guest) throw new NotFoundException('Guest not found');
    return guest;
  }

  private async verifyRoomType(orgId: string, roomTypeId: string) {
    const roomType = await this.prisma.roomType.findFirst({
      where: { id: roomTypeId, organizationId: orgId },
    });
    if (!roomType) throw new NotFoundException('Room type not found');
    return roomType;
  }

  private async verifyReservation(user: AuthenticatedUser, id: string) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id, organizationId: user.organizationId },
      include: { guest: true, ratePlan: true, room: true },
    });
    if (!reservation) throw new NotFoundException('Reservation not found');
    return reservation;
  }

  private async getRoomHotel(roomId: string): Promise<string> {
    const room = await this.prisma.room.findUnique({ where: { id: roomId }, select: { hotelId: true } });
    if (!room) throw new NotFoundException('Room not found');
    return room.hotelId;
  }

  private async defaultHotel(orgId: string): Promise<string> {
    const hotel = await this.prisma.hotel.findFirst({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!hotel) throw new BadRequestException('No hotel found for the organization');
    return hotel.id;
  }

  private async validateDateRange(checkIn: Date, checkOut: Date) {
    if (!isDateRangeValid(checkIn, checkOut)) {
      throw new BadRequestException('Check-out date must be after check-in date');
    }
    const maxNights = 365;
    const nights = nightsBetween(checkIn, checkOut);
    if (nights > maxNights) {
      throw new BadRequestException(`Reservation cannot exceed ${maxNights} nights`);
    }
  }

  private async validateGuestCount(
    adultCapacity: number,
    childCapacity: number,
    adults: number,
    children: number
  ) {
    if (adults > adultCapacity) {
      throw new BadRequestException(
        `Room type does not accommodate ${adults} adults (max ${adultCapacity})`
      );
    }
    if (children > childCapacity) {
      throw new BadRequestException(
        `Room type does not accommodate ${children} children (max ${childCapacity})`
      );
    }
    if (adults < 1) {
      throw new BadRequestException('At least one adult is required');
    }
  }
}