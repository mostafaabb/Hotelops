import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FolioEntryType,
  PaymentMethod,
  PaymentStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { roundAmount, sumMoney } from '../../common/utils/money.util';
import { startOfDay, endOfDay } from '../../common/utils/date.util';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

export interface CreatePaymentInput {
  reservationId?: string;
  guestId?: string;
  folioId?: string;
  amount: number;
  method?: PaymentMethod;
  reference?: string;
  transactionId?: string;
  paymentType?: 'PAYMENT' | 'DEPOSIT' | 'REFUND';
  notes?: string;
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService
  ) {}

  async findAll(
    user: AuthenticatedUser,
    query: {
      page?: number;
      pageSize?: number;
      search?: string;
      hotelId?: string;
      status?: PaymentStatus;
      method?: PaymentMethod;
      from?: string;
      to?: string;
    }
  ) {
    const page = query.page || 1;
    const pageSize = Math.min(query.pageSize || 20, 100);
    const where: any = { organizationId: user.organizationId };
    if (query.hotelId) where.hotelId = query.hotelId;
    if (query.status) where.status = query.status;
    if (query.method) where.method = query.method;
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = startOfDay(query.from);
      if (query.to) where.createdAt.lte = endOfDay(query.to);
    }
    if (query.search) {
      where.OR = [
        { reference: { contains: query.search, mode: 'insensitive' } },
        { transactionId: { contains: query.search, mode: 'insensitive' } },
        { guest: { firstName: { contains: query.search, mode: 'insensitive' } } },
        { guest: { lastName: { contains: query.search, mode: 'insensitive' } } },
        { reservation: { confirmationNumber: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const [items, total, aggregate] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: {
          guest: { select: { id: true, firstName: true, lastName: true } },
          reservation: { select: { id: true, confirmationNumber: true } },
          receivedByUser: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.payment.count({ where }),
      this.prisma.payment.aggregate({
        where: { ...where, status: PaymentStatus.COMPLETED },
        _sum: { amount: true },
      }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalCompleted: Number(aggregate._sum.amount || 0),
    };
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, organizationId: user.organizationId },
      include: {
        guest: true,
        reservation: true,
        folio: { include: { entries: true } },
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  async create(user: AuthenticatedUser, input: CreatePaymentInput) {
    if (input.amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }

    let guestId = input.guestId;
    let hotelId = user.hotelId;
    let reservation: any = null;

    if (input.reservationId) {
      reservation = await this.prisma.reservation.findFirst({
        where: { id: input.reservationId, organizationId: user.organizationId },
        include: { folio: true },
      });
      if (!reservation) throw new NotFoundException('Reservation not found');
      guestId = reservation.guestId;
      hotelId = reservation.hotelId;
    }

    if (!guestId) throw new BadRequestException('Guest is required');
    const guest = await this.prisma.guest.findFirst({
      where: { id: guestId, organizationId: user.organizationId },
    });
    if (!guest) throw new NotFoundException('Guest not found');

    if (!hotelId) {
      const hotel = await this.prisma.hotel.findFirst({
        where: { organizationId: user.organizationId },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      if (!hotel) throw new BadRequestException('No hotel available');
      hotelId = hotel.id;
    }

    const amount = roundAmount(input.amount);

    const result = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          organizationId: user.organizationId,
          hotelId: hotelId!,
          reservationId: input.reservationId,
          guestId: guest.id,
          folioId: reservation?.folio?.id,
          amount,
          method: input.method || PaymentMethod.CASH,
          status: PaymentStatus.COMPLETED,
          reference: input.reference,
          transactionId: input.transactionId,
          paymentType: input.paymentType || 'PAYMENT',
          notes: input.notes,
          createdBy: user.id,
          receivedBy: user.id,
          receivedAt: new Date(),
        },
      });

      if (reservation) {
        const folioId = reservation.folio?.id;
        if (folioId) {
          const entries = await tx.folioEntry.findMany({ where: { folioId } });
          const payments = await tx.payment.findMany({ where: { folioId } });
          const charges = sumMoney(
            entries
              .filter((e) => e.type !== FolioEntryType.REFUND)
              .map((e) => Number(e.amount) + Number(e.taxAmount))
          );
          const refunds = sumMoney(
            entries
              .filter((e) => e.type === FolioEntryType.REFUND)
              .map((e) => -Number(e.amount))
          );
          const paid = sumMoney(payments.map((p) => Number(p.amount)));
          const balance = roundAmount(charges - paid - refunds);

          await tx.folio.update({
            where: { id: folioId },
            data: { paidAmount: paid, balance },
          });
        }

        const newAmountPaid = roundAmount(Number(reservation.amountPaid) + amount);
        await tx.reservation.update({
          where: { id: reservation.id },
          data: {
            amountPaid: newAmountPaid,
            balance: roundAmount(Number(reservation.total) - newAmountPaid),
          },
        });
      }

      return payment;
    });

    await this.auditService.record(user.id, user.organizationId, 'PAYMENT', 'Payment', result.id, {
      newValue: { amount, method: result.method, reservationId: input.reservationId },
    });

    await this.notificationsService.notifyRole({
      roles: ['GENERAL_MANAGER', 'ACCOUNTANT', 'HOTEL_MANAGER'],
      organizationId: user.organizationId,
      hotelId: hotelId!,
      type: 'PAYMENT',
      title: `Payment received: ${amount}`,
      body: `${guest.firstName} ${guest.lastName}${reservation ? ` · ${reservation.confirmationNumber}` : ''}`,
      link: `/finance/payments`,
      relatedId: result.id,
      relatedType: 'Payment',
    });

    return result;
  }

  async refund(user: AuthenticatedUser, paymentId: string, amount: number, reason?: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, organizationId: user.organizationId },
      include: { reservation: true, guest: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === PaymentStatus.REFUNDED) {
      throw new BadRequestException('Payment is already fully refunded');
    }

    const alreadyRefunded = await this.prisma.payment.aggregate({
      where: {
        organizationId: user.organizationId,
        paymentType: 'REFUND',
        reference: payment.id,
      },
      _sum: { amount: true },
    });
    const refundedSoFar = Math.abs(Number(alreadyRefunded._sum.amount || 0));
    const refundAmount = roundAmount(amount);
    const remaining = roundAmount(Number(payment.amount) - refundedSoFar);

    if (refundAmount <= 0) {
      throw new BadRequestException('Refund amount must be greater than zero');
    }
    if (refundAmount > remaining) {
      throw new BadRequestException(
        `Refund exceeds the refundable amount. Max refundable: ${remaining}`
      );
    }

    const fullyRefunded = refundAmount >= remaining;

    const result = await this.prisma.$transaction(async (tx) => {
      const refund = await tx.payment.create({
        data: {
          organizationId: user.organizationId,
          hotelId: payment.hotelId,
          reservationId: payment.reservationId,
          guestId: payment.guestId,
          folioId: payment.folioId,
          amount: -refundAmount,
          method: payment.method,
          status: PaymentStatus.COMPLETED,
          reference: payment.id,
          paymentType: 'REFUND',
          notes: reason,
          createdBy: user.id,
          receivedBy: user.id,
          receivedAt: new Date(),
        },
      });

      await tx.payment.update({
        where: { id: payment.id },
        data: { status: fullyRefunded ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED },
      });

      if (payment.folioId) {
        const folioId = payment.folioId;
        const entries = await tx.folioEntry.findMany({ where: { folioId } });
        const payments = await tx.payment.findMany({ where: { folioId } });
        const charges = sumMoney(
          entries
            .filter((e) => e.type !== FolioEntryType.REFUND)
            .map((e) => Number(e.amount) + Number(e.taxAmount))
        );
        const refunds = sumMoney(
          entries
            .filter((e) => e.type === FolioEntryType.REFUND)
            .map((e) => -Number(e.amount))
        );
        const paid = sumMoney(payments.map((p) => Number(p.amount)));
        const balance = roundAmount(charges - paid - refunds);
        await tx.folio.update({
          where: { id: folioId },
          data: {
            paidAmount: paid,
            balance,
            refundedAmount: { increment: refundAmount },
          },
        });
      }

      if (payment.reservationId && payment.reservation) {
        const newAmountPaid = roundAmount(Number(payment.reservation.amountPaid) - refundAmount);
        await tx.reservation.update({
          where: { id: payment.reservationId },
          data: {
            amountPaid: newAmountPaid,
            balance: roundAmount(Number(payment.reservation.total) - newAmountPaid),
          },
        });
      }

      return refund;
    });

    await this.auditService.record(user.id, user.organizationId, 'REFUND', 'Payment', paymentId, {
      newValue: { refundAmount, reason },
    });

    return result;
  }

  async summary(user: AuthenticatedUser, hotelId?: string, from?: string, to?: string) {
    const where: any = {
      organizationId: user.organizationId,
      status: PaymentStatus.COMPLETED,
      ...(hotelId ? { hotelId } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: startOfDay(from) } : {}),
              ...(to ? { lte: endOfDay(to) } : {}),
            },
          }
        : {}),
    };

    const [byMethod, totals] = await Promise.all([
      this.prisma.payment.groupBy({
        by: ['method'],
        where: { ...where, paymentType: 'PAYMENT' },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: { ...where, paymentType: 'PAYMENT' },
        _sum: { amount: true },
      }),
    ]);

    const refunds = await this.prisma.payment.aggregate({
      where: { ...where, paymentType: 'REFUND' },
      _sum: { amount: true },
    });

    return {
      total: Number(totals._sum.amount || 0),
      refunds: Math.abs(Number(refunds._sum.amount || 0)),
      byMethod: byMethod.map((m) => ({
        method: m.method,
        amount: Number(m._sum.amount || 0),
      })),
    };
  }
}