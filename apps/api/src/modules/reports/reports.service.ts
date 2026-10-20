import { Injectable } from '@nestjs/common';
import {
  ReservationStatus,
  RoomOperationalStatus,
  PaymentStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { startOfDay, endOfDay, nightsBetween } from '../../common/utils/date.util';
import { roundAmount } from '../../common/utils/money.util';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(
    user: AuthenticatedUser,
    query: { hotelId?: string; from?: string; to?: string }
  ) {
    const orgId = user.organizationId;
    const hotelId = query.hotelId;
    const from = query.from ? startOfDay(new Date(query.from)) : startOfDay(new Date());
    const to = query.to ? endOfDay(new Date(query.to)) : endOfDay(new Date());

    const hotelWhere = { organizationId: orgId, ...(hotelId ? { id: hotelId } : {}) };
    const resWhere: any = {
      organizationId: orgId,
      ...(hotelId ? { hotelId } : {}),
      checkInDate: { gte: from },
      checkOutDate: { lte: to },
    };

    const [hotels, rooms, confirmed, cancelled, checkedIn, checkedOutToday, noShows, payments] =
      await Promise.all([
        this.prisma.hotel.findMany({
          where: hotelWhere,
          select: { id: true, name: true, _count: { select: { rooms: true } } },
        }),
        this.prisma.room.count({
          where: { ...hotelWhere, status: { not: RoomOperationalStatus.OUT_OF_SERVICE } },
        }),
        this.prisma.reservation.count({
          where: { ...resWhere, status: ReservationStatus.CONFIRMED },
        }),
        this.prisma.reservation.count({
          where: { ...resWhere, status: ReservationStatus.CANCELLED },
        }),
        this.prisma.reservation.count({
          where: { organizationId: orgId, ...(hotelId ? { hotelId } : {}), status: ReservationStatus.CHECKED_IN },
        }),
        this.prisma.reservation.count({
          where: { organizationId: orgId, ...(hotelId ? { hotelId } : {}), checkOutAt: { gte: from, lte: to } },
        }),
        this.prisma.reservation.count({
          where: { organizationId: orgId, ...(hotelId ? { hotelId } : {}), status: ReservationStatus.NO_SHOW },
        }),
        this.prisma.payment.aggregate({
          where: {
            organizationId: orgId,
            ...(hotelId ? { hotelId } : {}),
            status: PaymentStatus.COMPLETED,
            receivedAt: { gte: from, lte: to },
          },
          _sum: { amount: true },
        }),
      ]);

    const soldRooms = await this.prisma.reservation.findMany({
      where: {
        organizationId: orgId,
        ...(hotelId ? { hotelId } : {}),
        status: { in: [ReservationStatus.CHECKED_IN, ReservationStatus.CHECKED_OUT, ReservationStatus.NO_SHOW] },
        checkInDate: { gte: from },
        checkOutDate: { lte: to },
        subtotal: { gt: 0 },
      },
      select: { id: true, subtotal: true, total: true, checkInDate: true, checkOutDate: true },
    });

    const totalNights = soldRooms.reduce(
      (acc, r) => acc + Math.max(1, nightsBetween(r.checkInDate, r.checkOutDate)),
      0
    );
    const occupiedRoomNights = totalNights;
    const availableRoomNights = rooms * Math.max(1, nightsBetween(from, to) + 1);
    const roomRevenue = roundAmount(soldRooms.reduce((acc, r) => acc + Number(r.subtotal), 0));

    const adr = totalNights > 0 ? roundAmount(roomRevenue / totalNights) : 0;
    const revpar = availableRoomNights > 0 ? roundAmount(roomRevenue / availableRoomNights) : 0;
    const occupancyRate =
      availableRoomNights > 0
        ? Math.min(100, roundAmount((occupiedRoomNights / availableRoomNights) * 100))
        : 0;

    const totalReservations = confirmed + cancelled + checkedIn + noShows;
    const cancellationRate =
      totalReservations > 0
        ? roundAmount((cancelled / totalReservations) * 100)
        : 0;

    const alos =
      checkedIn > 0
        ? roundAmount(
            soldRooms.reduce((acc, r) => acc + Math.max(1, nightsBetween(r.checkInDate, r.checkOutDate)), 0) /
              Math.max(1, checkedIn)
          )
        : 0;

    const revenueByMethod = await this.prisma.payment.groupBy({
      by: ['method'],
      where: {
        organizationId: orgId,
        ...(hotelId ? { hotelId } : {}),
        status: PaymentStatus.COMPLETED,
        receivedAt: { gte: from, lte: to },
      },
      _sum: { amount: true },
    });

    return {
      period: { from, to },
      hotels: hotels.map((h) => ({ id: h.id, name: h.name, roomCount: h._count.rooms })),
      rooms,
      occupancyRate,
      adr,
      revpar,
      alos,
      cancellationRate,
      reservations: { total: totalReservations, confirmed, cancelled, checkedIn, noShows },
      checkedOutToday,
      revenue: {
        roomRevenue,
        collected: Number(payments._sum.amount || 0),
        byMethod: revenueByMethod.map((r) => ({
          method: r.method,
          amount: Number(r._sum.amount || 0),
        })),
      },
    };
  }

  async dailySeries(
    user: AuthenticatedUser,
    query: { hotelId?: string; from?: string; to?: string; days?: number }
  ) {
    const days = Math.min(Math.max(query.days || 30, 7), 365);
    const to = query.to ? startOfDay(new Date(query.to)) : startOfDay(new Date());
    const from = new Date(to);
    from.setDate(from.getDate() - (days - 1));
    const fromDay = startOfDay(from);
    const toDay = endOfDay(to);

    const orgId = user.organizationId;

    const [reservations, payments, checkoutCounts, inventoryProducts] = await Promise.all([
      this.prisma.reservation.findMany({
        where: {
          organizationId: orgId,
          ...(query.hotelId ? { hotelId: query.hotelId } : {}),
          createdAt: { gte: fromDay, lte: toDay },
        },
        select: { id: true, createdAt: true, status: true, total: true, amountPaid: true },
      }),
      this.prisma.payment.findMany({
        where: {
          organizationId: orgId,
          ...(query.hotelId ? { hotelId: query.hotelId } : {}),
          status: PaymentStatus.COMPLETED,
          receivedAt: { gte: fromDay, lte: toDay },
        },
        select: { receivedAt: true, amount: true },
      }),
      this.prisma.reservation.count({
        where: {
          organizationId: orgId,
          ...(query.hotelId ? { hotelId: query.hotelId } : {}),
          status: ReservationStatus.CHECKED_OUT,
          checkOutAt: { gte: fromDay, lte: toDay },
        },
      }),
      this.prisma.inventoryProduct.findMany({
        where: {
          organizationId: orgId,
          ...(query.hotelId ? { hotelId: query.hotelId } : {}),
        },
        select: { id: true, name: true, quantity: true, minimumStock: true, hotelId: true },
      }),
    ]);

    const inventoryAlerts = inventoryProducts.filter(
      (p) => Number(p.quantity) <= Number(p.minimumStock)
    );

    const series: any[] = [];
    for (let i = 0; i < days; i++) {
      const day = new Date(fromDay);
      day.setDate(day.getDate() + i);
      const dayStart = startOfDay(day);
      const dayEnd = endOfDay(day);

      const dayRes = reservations.filter(
        (r) => r.createdAt >= dayStart && r.createdAt <= dayEnd
      );
      const dayPayments = payments.filter(
        (p) => p.receivedAt && p.receivedAt >= dayStart && p.receivedAt <= dayEnd
      );

      series.push({
        date: day,
        newReservations: dayRes.length,
        cancellations: dayRes.filter((r) => r.status === ReservationStatus.CANCELLED).length,
        revenue: roundAmount(
          dayPayments.reduce((acc, p) => acc + Number(p.amount), 0)
        ),
        bookedValue: roundAmount(dayRes.reduce((acc, r) => acc + Number(r.total), 0)),
      });
    }

    return {
      dates: { from: fromDay, to: toDay },
      series,
      checkoutsInPeriod: checkoutCounts,
      inventoryAlerts: inventoryAlerts.map((i) => ({
        id: i.id,
        name: i.name,
        quantity: i.quantity,
        reorderLevel: i.minimumStock,
        hotelId: i.hotelId,
      })),
    };
  }

  async revenueByCategory(
    user: AuthenticatedUser,
    query: { hotelId?: string; from?: string; to?: string }
  ) {
    const orgId = user.organizationId;
    const from = query.from ? startOfDay(new Date(query.from)) : startOfDay(new Date(new Date().setDate(new Date().getDate() - 30)));
    const to = query.to ? endOfDay(new Date(query.to)) : endOfDay(new Date());
    const hWhere = { organizationId: orgId, ...(query.hotelId ? { hotelId: query.hotelId } : {}) };

    const [payments, folioEntries, expenses] = await Promise.all([
      this.prisma.payment.groupBy({
        by: ['method'],
        where: {
          organizationId: orgId,
          ...(query.hotelId ? { hotelId: query.hotelId } : {}),
          status: PaymentStatus.COMPLETED,
          receivedAt: { gte: from, lte: to },
        },
        _sum: { amount: true },
      }),
      this.prisma.folioEntry.groupBy({
        by: ['type'],
        where: {
          folio: {
            reservation: {
              organizationId: orgId,
              ...(query.hotelId ? { hotelId: query.hotelId } : {}),
            },
          },
          createdAt: { gte: from, lte: to },
        },
        _sum: { amount: true, taxAmount: true },
      }),
      this.prisma.expense.groupBy({
        by: ['category'],
        where: {
          organizationId: orgId,
          ...(query.hotelId ? { hotelId: query.hotelId } : {}),
          date: { gte: from, lte: to },
        },
        _sum: { amount: true },
      }),
    ]);

    return {
      period: { from, to },
      revenueByMethod: payments.map((p) => ({
        method: p.method,
        amount: Number(p._sum.amount || 0),
      })),
      revenueByChargeType: folioEntries.map((e) => ({
        type: e.type,
        amount: Number(e._sum?.amount ?? 0) + Number(e._sum?.taxAmount ?? 0),
      })),
      expensesByCategory: expenses.map((e) => ({
        category: e.category,
        amount: Number(e._sum.amount || 0),
      })),
    };
  }

  async sourceBreakdown(
    user: AuthenticatedUser,
    query: { hotelId?: string; from?: string; to?: string }
  ) {
    const orgId = user.organizationId;
    const from = query.from ? startOfDay(new Date(query.from)) : startOfDay(new Date(new Date().setDate(new Date().getDate() - 30)));
    const to = query.to ? endOfDay(new Date(query.to)) : endOfDay(new Date());

    const grouped = await this.prisma.reservation.groupBy({
      by: ['source', 'status'],
      where: {
        organizationId: orgId,
        ...(query.hotelId ? { hotelId: query.hotelId } : {}),
        createdAt: { gte: from, lte: to },
      },
      _count: { _all: true },
      _sum: { total: true },
    });

    const bySource: Record<string, { count: number; cancelled: number; revenue: number }> = {};
    for (const g of grouped) {
      const key = g.source;
      bySource[key] = bySource[key] || { count: 0, cancelled: 0, revenue: 0 };
      bySource[key].count += g._count._all;
      bySource[key].revenue += Number(g._sum.total || 0);
      if (g.status === ReservationStatus.CANCELLED) bySource[key].cancelled += g._count._all;
    }

    return {
      period: { from, to },
      bySource: Object.entries(bySource).map(([source, v]) => ({
        source,
        count: v.count,
        revenue: roundAmount(v.revenue),
        cancellationRate: v.count > 0 ? roundAmount((v.cancelled / v.count) * 100) : 0,
      })),
    };
  }

  async topGuests(
    user: AuthenticatedUser,
    query: { hotelId?: string; limit?: number }
  ) {
    const limit = Math.min(query.limit || 10, 50);
    const guests = await this.prisma.guest.findMany({
      where: { organizationId: user.organizationId },
      include: {
        reservations: {
          where: { status: { in: [ReservationStatus.CHECKED_IN, ReservationStatus.CHECKED_OUT, ReservationStatus.NO_SHOW] } },
          select: { total: true },
        },
        payments: {
          where: { status: PaymentStatus.COMPLETED },
          select: { amount: true },
        },
        _count: { select: { reservations: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: Math.min(200, limit * 20),
    });

    const ranked = guests
      .map((g) => ({
        id: g.id,
        firstName: g.firstName,
        lastName: g.lastName,
        email: g.email,
        phone: g.phone,
        isVip: g.isVip,
        vipLevel: g.vipLevel,
        totalStays: g._count.reservations,
        totalSpend: roundAmount(g.payments.reduce((a, p) => a + Number(p.amount), 0)),
      }))
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, limit);

    return { items: ranked };
  }

  async housekeepingEfficiency(user: AuthenticatedUser, query: { hotelId?: string }) {
    const orgId = user.organizationId;
    const hotelWhere = { organizationId: orgId, ...(query.hotelId ? { id: query.hotelId } : {}) };
    const tasks = await this.prisma.housekeepingTask.findMany({
      where: {
        organizationId: orgId,
        ...(query.hotelId ? { hotelId: query.hotelId } : {}),
        completedAt: { not: null },
      },
      select: {
        assignedTo: true,
        startedAt: true,
        completedAt: true,
        priority: true,
        roomId: true,
      },
    });
    const durations = tasks
      .filter((t) => t.startedAt && t.completedAt)
      .map((t) => (t.completedAt!.getTime() - t.startedAt!.getTime()) / 60000)
      .filter((d) => d > 0 && d < 600);

    return {
      total: tasks.length,
      avgMinutes: durations.length
        ? roundAmount(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0,
      pending: tasks.length,
      efficiencyScore: tasks.length ? Math.min(100, roundAmount((tasks.length / (tasks.length + 1)) * 100)) : 0,
    };
  }
}