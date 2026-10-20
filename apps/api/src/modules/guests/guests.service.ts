import { Injectable, NotFoundException } from '@nestjs/common';
import { GuestStatus, Prisma, ReservationStatus } from '@prisma/client';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

interface GuestListQuery {
  page?: string;
  pageSize?: string;
  search?: string;
  isVip?: string;
  status?: string;
  hotelId?: string;
}

@Injectable()
export class GuestsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: AuthenticatedUser, query: GuestListQuery) {
    const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(query.pageSize ?? '20', 10) || 20)
    );

    const where: Prisma.GuestWhereInput = {
      organizationId: user.organizationId,
    };
    if (query.hotelId) where.hotelId = query.hotelId;
    if (query.status) where.status = query.status as GuestStatus;
    if (query.isVip !== undefined) where.isVip = query.isVip === 'true';
    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.guest.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { reservations: true } } },
      }),
      this.prisma.guest.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const guest = await this.prisma.guest.findFirst({
      where: { id, organizationId: user.organizationId },
      include: {
        reservations: {
          take: 20,
          orderBy: { checkInDate: 'desc' },
          include: { room: true, roomType: true },
        },
        folios: { orderBy: { createdAt: 'desc' }, take: 20 },
        payments: { orderBy: { createdAt: 'desc' }, take: 20 },
        serviceOrders: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { service: true },
        },
      },
    });
    if (!guest) throw new NotFoundException('Guest not found');

    const completed = await this.prisma.reservation.findMany({
      where: {
        guestId: id,
        organizationId: user.organizationId,
        status: { in: [ReservationStatus.CHECKED_OUT, ReservationStatus.COMPLETED] },
      },
      select: { checkInDate: true, checkOutDate: true, checkOutAt: true },
    });

    const totalStays = completed.length;
    let totalNights = 0;
    let lastVisit: Date | null = null;
    for (const reservation of completed) {
      const out = reservation.checkOutAt ?? reservation.checkOutDate;
      totalNights += this.nightsBetween(reservation.checkInDate, out);
      if (!lastVisit || out.getTime() > lastVisit.getTime()) lastVisit = out;
    }
    const averageStay =
      totalStays > 0 ? Number((totalNights / totalStays).toFixed(2)) : 0;

    const paymentAgg = await this.prisma.payment.aggregate({
      where: { guestId: id, organizationId: user.organizationId, status: 'COMPLETED' },
      _sum: { amount: true },
    });
    const totalSpent = paymentAgg._sum.amount ? paymentAgg._sum.amount.toNumber() : 0;

    return {
      ...guest,
      stats: { totalStays, totalSpent, averageStay, lastVisit },
    };
  }

  async history(user: AuthenticatedUser, id: string) {
    const guest = await this.prisma.guest.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!guest) throw new NotFoundException('Guest not found');

    const previousStays = await this.prisma.reservation.findMany({
      where: {
        guestId: id,
        organizationId: user.organizationId,
        status: { in: [ReservationStatus.CHECKED_OUT, ReservationStatus.COMPLETED] },
      },
      orderBy: { checkOutDate: 'desc' },
      include: { room: true, roomType: true },
    });

    const upcomingReservations = await this.prisma.reservation.findMany({
      where: {
        guestId: id,
        organizationId: user.organizationId,
        status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN] },
        checkInDate: { gte: new Date() },
      },
      orderBy: { checkInDate: 'asc' },
      include: { room: true, roomType: true },
    });

    const paymentHistory = await this.prisma.payment.findMany({
      where: { guestId: id, organizationId: user.organizationId },
      orderBy: { createdAt: 'desc' },
    });

    const paymentAgg = await this.prisma.payment.aggregate({
      where: { guestId: id, organizationId: user.organizationId, status: 'COMPLETED' },
      _sum: { amount: true },
    });

    const totalNights = previousStays.reduce((acc, reservation) => {
      const out = reservation.checkOutAt ?? reservation.checkOutDate;
      return acc + this.nightsBetween(reservation.checkInDate, out);
    }, 0);
    const averageStay =
      previousStays.length > 0
        ? Number((totalNights / previousStays.length).toFixed(2))
        : 0;

    return {
      previousStays,
      upcomingReservations,
      totalSpent: paymentAgg._sum.amount ? paymentAgg._sum.amount.toNumber() : 0,
      averageStay,
      paymentHistory,
    };
  }

  private nightsBetween(checkInDate: Date, checkOutDate: Date): number {
    return Math.max(
      1,
      Math.round((checkOutDate.getTime() - checkInDate.getTime()) / 86400000)
    );
  }
}