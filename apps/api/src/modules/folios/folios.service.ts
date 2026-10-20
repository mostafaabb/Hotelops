import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FolioEntryType, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { roundAmount, sumMoney } from '../../common/utils/money.util';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

const FINANCE_ROLES: UserRole[] = [
  UserRole.OWNER,
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER,
  UserRole.HOTEL_MANAGER,
  UserRole.ACCOUNTANT,
  UserRole.FRONT_DESK,
];

@Injectable()
export class FoliosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async findAll(
    user: AuthenticatedUser,
    query: {
      page?: number;
      pageSize?: number;
      search?: string;
      hotelId?: string;
      hasBalance?: string;
    }
  ) {
    const page = query.page || 1;
    const pageSize = Math.min(query.pageSize || 20, 100);
    const reservationWhere: any = { organizationId: user.organizationId };
    if (query.search) {
      reservationWhere.OR = [
        { confirmationNumber: { contains: query.search, mode: 'insensitive' } },
        { guest: { firstName: { contains: query.search, mode: 'insensitive' } } },
        { guest: { lastName: { contains: query.search, mode: 'insensitive' } } },
      ];
    }
    const where: any = { reservation: reservationWhere };
    if (query.hotelId) where.hotelId = query.hotelId;
    if (query.hasBalance === 'true') where.balance = { gt: 0 };

    const [items, total, aggregate] = await Promise.all([
      this.prisma.folio.findMany({
        where,
        include: {
          reservation: {
            select: {
              id: true,
              confirmationNumber: true,
              status: true,
              checkInDate: true,
              checkOutDate: true,
            },
          },
          guest: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { entries: true, payments: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.folio.count({ where }),
      this.prisma.folio.aggregate({ where, _sum: { balance: true } }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalOutstanding: Number(aggregate._sum.balance || 0),
    };
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const folio = await this.prisma.folio.findFirst({
      where: { id },
      include: {
        reservation: {
          include: {
            guest: true,
            room: { select: { roomNumber: true } },
          },
        },
        guest: true,
        entries: {
          orderBy: { createdAt: 'asc' },
          include: { createdByUser: { select: { id: true, firstName: true, lastName: true } } },
        },
        payments: {
          orderBy: { createdAt: 'asc' },
          include: { receivedByUser: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    });
    if (!folio) throw new NotFoundException('Folio not found');
    if (folio.reservation?.organizationId !== user.organizationId) {
      throw new NotFoundException('Folio not found');
    }
    return folio;
  }

  async findByReservation(user: AuthenticatedUser, reservationId: string) {
    const folio = await this.prisma.folio.findFirst({
      where: { reservationId, reservation: { organizationId: user.organizationId } },
      include: {
        entries: { orderBy: { createdAt: 'asc' } },
        payments: { orderBy: { createdAt: 'asc' } },
        reservation: { include: { guest: true, room: true } },
      },
    });
    if (!folio) throw new NotFoundException('Folio not found');
    return folio;
  }

  async addEntry(
    user: AuthenticatedUser,
    folioId: string,
    input: {
      type: FolioEntryType;
      description: string;
      amount: number;
      taxAmount?: number;
      quantity?: number;
    }
  ) {
    const folio = await this.prisma.folio.findFirst({
      where: { id: folioId, reservation: { organizationId: user.organizationId } },
    });
    if (!folio) throw new NotFoundException('Folio not found');

    if (!input.description || !input.description.trim()) {
      throw new BadRequestException('Description is required');
    }
    if (typeof input.amount !== 'number' || Number.isNaN(input.amount)) {
      throw new BadRequestException('Valid amount is required');
    }

    const amount = roundAmount(input.amount);
    const taxAmount = roundAmount(input.taxAmount || 0);

    const entry = await this.prisma.$transaction(async (tx) => {
      const created = await tx.folioEntry.create({
        data: {
          folioId,
          reservationId: folio.reservationId,
          type: input.type,
          description: input.description,
          amount,
          taxAmount,
          quantity: input.quantity || 1,
          createdBy: user.id,
        },
      });

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

      await tx.folio.update({ where: { id: folioId }, data: { balance } });

      return created;
    });

    await this.auditService.record(user.id, user.organizationId, 'CREATE', 'FolioEntry', entry.id, {
      newValue: { folioId, type: input.type, amount },
    });

    return entry;
  }

  isFinanceRole(role: string): boolean {
    return FINANCE_ROLES.includes(role as UserRole);
  }
}