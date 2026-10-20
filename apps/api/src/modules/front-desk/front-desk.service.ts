import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityType,
  FolioEntryType,
  HousekeepingTaskStatus,
  HousekeepingStatus,
  InvoiceStatus,
  ReservationStatus,
  RoomOperationalStatus,
  TaskPriority,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { startOfDay, endOfDay } from '../../common/utils/date.util';
import { roundAmount, sumMoney } from '../../common/utils/money.util';
import { generateInvoiceNumber } from '../../common/utils/id.util';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class FrontDeskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService
  ) {}

  async board(user: AuthenticatedUser, date?: string) {
    const today = startOfDay(date || new Date());
    const tomorrow = endOfDay(date || new Date());
    const hotelId = user.hotelId;

    const hotelFilter = hotelId ? { hotelId } : {};

    const [arrivals, departures, currentGuests, rooms] = await Promise.all([
      this.prisma.reservation.findMany({
        where: {
          organizationId: user.organizationId,
          ...hotelFilter,
          checkInDate: { gte: today, lte: tomorrow },
          status: {
            in: [ReservationStatus.CONFIRMED, ReservationStatus.INQUIRY],
          },
        },
        include: {
          guest: true,
          room: { select: { roomNumber: true } },
          roomType: true,
        },
        orderBy: { checkInDate: 'asc' },
      }),
      this.prisma.reservation.findMany({
        where: {
          organizationId: user.organizationId,
          ...hotelFilter,
          checkOutDate: { gte: today, lte: tomorrow },
          status: {
            in: [ReservationStatus.CHECKED_IN, ReservationStatus.CONFIRMED],
          },
        },
        include: {
          guest: true,
          room: { select: { roomNumber: true } },
          roomType: true,
        },
        orderBy: { checkOutDate: 'asc' },
      }),
      this.prisma.reservation.findMany({
        where: {
          organizationId: user.organizationId,
          ...hotelFilter,
          status: ReservationStatus.CHECKED_IN,
        },
        include: {
          guest: true,
          room: { select: { roomNumber: true, housekeepingStatus: true } },
          folio: { select: { balance: true } },
        },
        orderBy: { checkInDate: 'asc' },
      }),
      this.prisma.room.findMany({
        where: {
          organizationId: user.organizationId,
          ...hotelFilter,
        },
        select: {
          id: true,
          roomNumber: true,
          status: true,
          housekeepingStatus: true,
        },
      }),
    ]);

    const byStatus = (s: RoomOperationalStatus) => rooms.filter((r) => r.status === s).length;

    return {
      date: today,
      arrivals,
      departures,
      currentGuests,
      counts: {
        totalRooms: rooms.length,
        availableRooms: byStatus(RoomOperationalStatus.AVAILABLE),
        occupiedRooms: byStatus(RoomOperationalStatus.OCCUPIED),
        dirtyRooms: rooms.filter((r) => r.housekeepingStatus === HousekeepingStatus.DIRTY).length,
        cleaningRooms: rooms.filter((r) => r.housekeepingStatus === HousekeepingStatus.CLEANING).length,
        outOfOrder: byStatus(RoomOperationalStatus.OUT_OF_ORDER),
        outOfService: byStatus(RoomOperationalStatus.OUT_OF_SERVICE),
        arrivalsCount: arrivals.length,
        departuresCount: departures.length,
        inHouseCount: currentGuests.length,
      },
    };
  }

  async checkIn(user: AuthenticatedUser, reservationId: string) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id: reservationId, organizationId: user.organizationId },
      include: { guest: true, room: true, roomType: true },
    });

    if (!reservation) throw new NotFoundException('Reservation not found');

    if (
      reservation.status !== ReservationStatus.CONFIRMED &&
      reservation.status !== ReservationStatus.INQUIRY
    ) {
      throw new ConflictException(
        `Cannot check in a ${reservation.status} reservation`
      );
    }

    if (!reservation.roomId) {
      throw new BadRequestException('Reservation requires an assigned room before check-in');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.reservation.update({
        where: { id: reservationId },
        data: {
          status: ReservationStatus.CHECKED_IN,
          checkInAt: new Date(),
        },
      });

      await tx.room.update({
        where: { id: reservation.roomId! },
        data: { status: RoomOperationalStatus.OCCUPIED },
      });

      const existingAssignment = await tx.roomAssignment.findFirst({
        where: { reservationId },
        select: { id: true },
      });
      if (existingAssignment) {
        await tx.roomAssignment.update({
          where: { id: existingAssignment.id },
          data: { roomId: reservation.roomId! },
        });
      } else {
        await tx.roomAssignment.create({
          data: {
            reservationId,
            roomId: reservation.roomId!,
            assignedBy: user.id,
          },
        });
      }

      await tx.reservationActivity.create({
        data: {
          reservationId,
          type: ActivityType.CHECKED_IN,
          description: `Checked in guest ${reservation.guest.firstName} ${reservation.guest.lastName}`,
          performedBy: user.id,
        },
      });

      return updated;
    });

    await this.auditService.record(user.id, user.organizationId, 'CHECK_IN', 'Reservation', reservationId, {
      newValue: { guestId: reservation.guestId, roomId: reservation.roomId },
    });

    await this.notificationsService.notifyRole({
      roles: ['HOUSEKEEPING_MANAGER', 'GENERAL_MANAGER', 'HOTEL_MANAGER'],
      organizationId: user.organizationId,
      hotelId: reservation.hotelId,
      type: 'GUEST',
      title: `Guest checked in`,
      body: `${reservation.guest.firstName} ${reservation.guest.lastName} · Room ${reservation.room?.roomNumber}`,
      link: `/reservations/${reservation.confirmationNumber}`,
      relatedId: reservationId,
      relatedType: 'Reservation',
    });

    return this.getReservationWithFolio(reservationId);
  }

  async checkOut(user: AuthenticatedUser, reservationId: string) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id: reservationId, organizationId: user.organizationId },
      include: {
        guest: true,
        room: { select: { roomNumber: true } },
        folio: { include: { entries: true, payments: true } },
        serviceOrders: { where: { status: 'DELIVERED' } },
        hotel: true,
      },
    });

    if (!reservation) throw new NotFoundException('Reservation not found');
    if (reservation.status !== ReservationStatus.CHECKED_IN) {
      throw new ConflictException(
        `Cannot check out a ${reservation.status} reservation`
      );
    }
    if (!reservation.roomId) {
      throw new BadRequestException('Reservation has no room assigned');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Add any pending service order charges to the folio
      const folioId = reservation.folio?.id;
      if (folioId) {
        const pendingOrders = await tx.serviceOrder.findMany({
          where: {
            reservationId,
            status: { in: ['ORDERED', 'IN_PROGRESS', 'DELIVERED'] },
          },
        });

        const existingEntries = await tx.folioEntry.findMany({
          where: { folioId },
          select: { referenceId: true },
        });
        const existingRefs = new Set(existingEntries.map((e) => e.referenceId));

        for (const order of pendingOrders) {
          if (order.status === 'CANCELLED' || existingRefs.has(order.id)) continue;
          await tx.folioEntry.create({
            data: {
              folioId,
              reservationId,
              type: FolioEntryType.SERVICE,
              description: `Service: ${
                (await tx.hotelService.findUnique({ where: { id: order.serviceId } }))?.name || 'Service'
              }`,
              amount: Number(order.total) - Number(order.taxAmount),
              taxAmount: Number(order.taxAmount),
              quantity: order.quantity,
              referenceId: order.id,
              referenceType: 'ServiceOrder',
              createdBy: user.id,
            },
          });
          await tx.serviceOrder.update({
            where: { id: order.id },
            data: { status: 'COMPLETED' },
          });
        }

        // Recalculate folio balance
        const entries = await tx.folioEntry.findMany({ where: { folioId } });
        const payments = await tx.payment.findMany({ where: { folioId } });
        const totalCharges = sumMoney(
          entries
            .filter((e) => e.type !== FolioEntryType.REFUND)
            .map((e) => Number(e.amount) + Number(e.taxAmount))
        );
        const totalRefunds = sumMoney(
          entries
            .filter((e) => e.type === FolioEntryType.REFUND)
            .map((e) => -Number(e.amount))
        );
        const paid = sumMoney(payments.map((p) => Number(p.amount)));
        const balance = roundAmount(totalCharges - paid - totalRefunds);

        await tx.folio.update({
          where: { id: folioId },
          data: { balance, paidAmount: paid, refundedAmount: totalRefunds },
        });

        // Generate invoice
        const year = new Date().getFullYear();
        const seqKey = `invoice-${year}`;
        const seq = await tx.sequence.upsert({
          where: { id: seqKey },
          create: { id: seqKey, value: 1 },
          update: { value: { increment: 1 } },
        });
        const invoiceNumber = generateInvoiceNumber(seq.value - 1, year);

        const taxes = sumMoney(entries.map((e) => Number(e.taxAmount)));
        const discounts = sumMoney(
          entries
            .filter((e) => e.type === FolioEntryType.DISCOUNT)
            .map((e) => -Number(e.amount))
        );
        const subtotal = sumMoney(
          entries
            .filter((e) => e.type !== FolioEntryType.TAX && e.type !== FolioEntryType.DISCOUNT)
            .map((e) => Number(e.amount))
        );
        const total = roundAmount(subtotal + taxes - discounts);
        const invoiceBalance = roundAmount(total - paid - totalRefunds);

        const invoice = await tx.invoice.create({
          data: {
            invoiceNumber,
            organizationId: reservation.organizationId,
            hotelId: reservation.hotelId,
            reservationId,
            guestId: reservation.guestId,
            folioId,
            status:
              invoiceBalance <= 0
                ? InvoiceStatus.PAID
                : paid > 0
                  ? InvoiceStatus.PARTIALLY_PAID
                  : InvoiceStatus.ISSUED,
            subtotal,
            taxTotal: taxes,
            discountTotal: discounts,
            total,
            amountPaid: paid,
            balance: invoiceBalance,
            createdBy: user.id,
          },
        });

        for (const entry of entries) {
          await tx.invoiceItem.create({
            data: {
              invoiceId: invoice.id,
              description: entry.description,
              quantity: entry.quantity,
              unitPrice: Number(entry.amount),
              taxAmount: Number(entry.taxAmount),
              amount: Number(entry.amount) + Number(entry.taxAmount),
            },
          });
        }
      }

      const updated = await tx.reservation.update({
        where: { id: reservationId },
        data: {
          status: ReservationStatus.CHECKED_OUT,
          checkOutAt: new Date(),
        },
      });

      // Room becomes DIRTY + housekeeping task created
      await tx.room.update({
        where: { id: reservation.roomId! },
        data: {
          status: RoomOperationalStatus.DIRTY,
          housekeepingStatus: HousekeepingStatus.DIRTY,
        },
      });

      const taskSequence = await tx.sequence.upsert({
        where: { id: `task-${new Date().getFullYear()}` },
        create: { id: `task-${new Date().getFullYear()}`, value: 1 },
        update: { value: { increment: 1 } },
      });

      const taskNumber = `TSK-${new Date().getFullYear()}-${String(taskSequence.value - 1).padStart(4, '0')}`;

      await tx.housekeepingTask.create({
        data: {
          organizationId: reservation.organizationId,
          hotelId: reservation.hotelId,
          roomId: reservation.roomId!,
          reservationId,
          priority: TaskPriority.MEDIUM,
          status: HousekeepingTaskStatus.PENDING,
          notes: `Auto-generated after check-out (${reservation.confirmationNumber})`,
          createdBy: user.id,
        },
      });

      await tx.reservationActivity.create({
        data: {
          reservationId,
          type: ActivityType.CHECKED_OUT,
          description: `Checked out guest ${reservation.guest.firstName} ${reservation.guest.lastName}`,
          performedBy: user.id,
        },
      });

      return { updated, taskNumber };
    });

    await this.auditService.record(user.id, user.organizationId, 'CHECK_OUT', 'Reservation', reservationId, {
      newValue: { status: 'CHECKED_OUT' },
    });

    await this.notificationsService.notifyRole({
      roles: ['HOUSEKEEPING_MANAGER', 'HOUSEKEEPER', 'GENERAL_MANAGER'],
      organizationId: user.organizationId,
      hotelId: reservation.hotelId,
      type: 'HOUSEKEEPING',
      title: 'Room needs cleaning',
      body: `${reservation.room?.roomNumber} marked dirty after check-out`,
      link: `/housekeeping`,
      relatedId: reservation.roomId,
      relatedType: 'Room',
    });

    return this.getReservationWithFolio(reservationId);
  }

  async noShow(user: AuthenticatedUser, reservationId: string) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id: reservationId, organizationId: user.organizationId },
    });
    if (!reservation) throw new NotFoundException('Reservation not found');

    if (
      reservation.status !== ReservationStatus.CONFIRMED &&
      reservation.status !== ReservationStatus.INQUIRY
    ) {
      throw new ConflictException('Only confirmed or inquiry reservations can be marked as no-show');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.reservation.update({
        where: { id: reservationId },
        data: {
          status: ReservationStatus.NO_SHOW,
          noShowAt: new Date(),
        },
      });
      await tx.reservationActivity.create({
        data: {
          reservationId,
          type: ActivityType.NO_SHOW,
          description: 'Guest marked as no-show',
          performedBy: user.id,
        },
      });
      return result;
    });

    await this.auditService.record(user.id, user.organizationId, 'CHANGE', 'Reservation', reservationId, {
      newValue: { status: 'NO_SHOW' },
    });

    return updated;
  }

  private async getReservationWithFolio(reservationId: string) {
    return this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        guest: true,
        room: { include: { roomType: true } },
        roomType: true,
        folio: {
          include: {
            entries: { orderBy: { createdAt: 'asc' } },
            payments: { orderBy: { createdAt: 'asc' } },
          },
        },
        invoices: true,
        serviceOrders: { include: { service: true } },
        activities: { include: { performedByUser: true } },
      },
    });
  }
}