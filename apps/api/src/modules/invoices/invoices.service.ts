import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { roundAmount, sumMoney } from '../../common/utils/money.util';
import { startOfDay, endOfDay } from '../../common/utils/date.util';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class InvoicesService {
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
      status?: InvoiceStatus;
      from?: string;
      to?: string;
    }
  ) {
    const page = query.page || 1;
    const pageSize = Math.min(query.pageSize || 20, 100);
    const where: any = { organizationId: user.organizationId };
    if (query.hotelId) where.hotelId = query.hotelId;
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { invoiceNumber: { contains: query.search, mode: 'insensitive' } },
        { guest: { firstName: { contains: query.search, mode: 'insensitive' } } },
        { guest: { lastName: { contains: query.search, mode: 'insensitive' } } },
        { reservation: { confirmationNumber: { contains: query.search, mode: 'insensitive' } } },
      ];
    }
    if (query.from || query.to) {
      where.issuedAt = {};
      if (query.from) where.issuedAt.gte = startOfDay(new Date(query.from));
      if (query.to) where.issuedAt.lte = endOfDay(new Date(query.to));
    }

    const [items, total, aggregate] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: {
          guest: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          reservation: { select: { id: true, confirmationNumber: true } },
          hotel: { select: { id: true, name: true } },
          _count: { select: { items: true, payments: true } },
        },
        orderBy: { issuedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.aggregate({
        where: { ...where, status: { not: InvoiceStatus.VOID } },
        _sum: { total: true, balance: true },
      }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalRevenue: Number(aggregate._sum.total || 0),
      totalOutstanding: Number(aggregate._sum.balance || 0),
    };
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, organizationId: user.organizationId },
      include: {
        guest: true,
        reservation: { include: { room: { select: { roomNumber: true } } } },
        hotel: { select: { id: true, name: true, address: true, phone: true, email: true } },
        items: { orderBy: { id: 'asc' } },
        payments: { orderBy: { createdAt: 'asc' } },
        folio: { select: { id: true } },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async void(user: AuthenticatedUser, id: string, reason: string) {
    if (!reason || !reason.trim()) {
      throw new BadRequestException('Void reason is required');
    }

    const invoice = await this.prisma.invoice.findFirst({
      where: { id, organizationId: user.organizationId },
      include: { payments: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status === InvoiceStatus.VOID) {
      throw new BadRequestException('Invoice is already voided');
    }
    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Paid invoices cannot be voided; issue a refund instead');
    }
    if (invoice.payments.length > 0) {
      throw new BadRequestException(
        'Invoice has recorded payments; issue refunds before voiding'
      );
    }

    const voided = await this.prisma.$transaction(async (tx) => {
      return tx.invoice.update({
        where: { id },
        data: { status: InvoiceStatus.VOID, voidReason: reason },
      });
    });

    await this.auditService.record(user.id, user.organizationId, 'UPDATE', 'Invoice', id, {
      newValue: { reason },
    });
    await this.notificationsService.notifyRole({
      organizationId: user.organizationId,
      hotelId: invoice.hotelId,
      roles: ['OWNER', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'HOTEL_MANAGER', 'ACCOUNTANT'] as any,
      type: 'SYSTEM' as any,
      title: `Invoice ${invoice.invoiceNumber} voided`,
      body: reason,
      relatedId: id,
      relatedType: 'Invoice',
    });

    return voided;
  }

  async generateFromFolio(user: AuthenticatedUser, folioId: string) {
    const folio = await this.prisma.folio.findFirst({
      where: { id: folioId, reservation: { organizationId: user.organizationId } },
      include: {
        reservation: { include: { guest: true } },
        entries: true,
        payments: true,
      },
    });
    if (!folio) throw new NotFoundException('Folio not found');

    const existingOpen = await this.prisma.invoice.findFirst({
      where: { folioId, status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE, InvoiceStatus.DRAFT] } },
    });
    if (existingOpen) {
      throw new BadRequestException('Folio already has an open invoice');
    }

    const included = folio.entries.filter((e) => e.type !== 'REFUND');
    if (included.length === 0) {
      throw new BadRequestException('Folio has no chargeable entries');
    }

    const year = new Date().getFullYear();
    const seq = await this.prisma.sequence.upsert({
      where: { id: `invoice-${year}` },
      create: { id: `invoice-${year}`, value: 1 },
      update: { value: { increment: 1 } },
    });
    const invoiceNumber = `INV-${year}-${String(seq.value - 1).padStart(6, '0')}`;

    const taxes = sumMoney(folio.entries.map((e) => Number(e.taxAmount)));
    const discounts = sumMoney(
      folio.entries
        .filter((e) => e.type === 'DISCOUNT')
        .map((e) => -Number(e.amount))
    );
    const subtotal = sumMoney(
      folio.entries
        .filter((e) => e.type !== 'TAX' && e.type !== 'DISCOUNT' && e.type !== 'REFUND')
        .map((e) => Number(e.amount))
    );
    const paid = sumMoney(folio.payments.map((p) => Number(p.amount)));
    const total = roundAmount(subtotal + taxes - discounts);
    const balance = roundAmount(Math.max(0, total - paid));

    const invoice = await this.prisma.$transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: {
          invoiceNumber,
          organizationId: folio.reservation.organizationId,
          hotelId: folio.hotelId,
          reservationId: folio.reservationId,
          guestId: folio.guestId,
          folioId,
          status:
            balance <= 0
              ? InvoiceStatus.PAID
              : paid > 0
                ? InvoiceStatus.PARTIALLY_PAID
                : InvoiceStatus.ISSUED,
          subtotal,
          taxTotal: taxes,
          discountTotal: discounts,
          total,
          amountPaid: paid,
          balance,
          createdBy: user.id,
        },
      });

      for (const entry of included) {
        await tx.invoiceItem.create({
          data: {
            invoiceId: created.id,
            description: entry.description,
            quantity: entry.quantity,
            unitPrice: Number(entry.amount),
            taxAmount: Number(entry.taxAmount),
            amount: roundAmount(Number(entry.amount) + Number(entry.taxAmount)),
          },
        });
      }

      if (folio.payments.length > 0) {
        await tx.payment.updateMany({
          where: { id: { in: folio.payments.map((p) => p.id) } },
          data: { invoiceId: created.id },
        });
      }

      return created;
    });

    await this.auditService.record(user.id, user.organizationId, 'CREATE', 'Invoice', invoice.id, {
      newValue: { folioId, total, invoiceNumber },
    });
    await this.notificationsService.notifyRole({
      organizationId: user.organizationId,
      hotelId: folio.hotelId,
      roles: ['OWNER', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'HOTEL_MANAGER', 'FRONT_DESK', 'ACCOUNTANT'] as any,
      type: 'SYSTEM' as any,
      title: `Invoice ${invoiceNumber} issued`,
      body: `${folio.reservation.guest.firstName} ${folio.reservation.guest.lastName} — $${total}`,
      relatedId: invoice.id,
      relatedType: 'Invoice',
    });

    return invoice;
  }

  isFinanceRole(role: string): boolean {
    const financeRoles: UserRole[] = [
      UserRole.OWNER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER,
      UserRole.HOTEL_MANAGER, UserRole.FRONT_DESK, UserRole.ACCOUNTANT,
    ];
    return financeRoles.includes(role as UserRole);
  }
}