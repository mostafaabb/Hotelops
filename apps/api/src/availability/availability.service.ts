import { Injectable } from '@nestjs/common';
import { Prisma, ReservationStatus, RoomOperationalStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { datesOverlap, isDateRangeValid, nightsBetween, startOfDay } from '../common/utils/date.util';

export interface AvailabilityQuery {
  organizationId: string;
  hotelId: string;
  checkIn: Date;
  checkOut: Date;
  roomTypeId?: string;
  excludeReservationId?: string;
  adults?: number;
  children?: number;
}

export interface AvailableRoom {
  id: string;
  roomNumber: string;
  floorId: string | null;
  roomTypeId: string;
  roomTypeName: string;
  capacity: number;
  basePrice: number;
  status: RoomOperationalStatus;
}

const ACTIVE_RESERVATION_STATUSES: ReservationStatus[] = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
  ReservationStatus.INQUIRY,
];

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Finds rooms available for the given date range.
   * A room is unavailable if:
   *  - It has an overlapping non-cancelled reservation
   *  - It is OUT_OF_ORDER or OUT_OF_SERVICE
   *  - It has an active room block overlapping the range
   */
  async findAvailableRooms(query: AvailabilityQuery): Promise<AvailableRoom[]> {
    if (!isDateRangeValid(query.checkIn, query.checkOut)) {
      throw new Error('Invalid date range');
    }

    const checkIn = startOfDay(query.checkIn);
    const checkOut = startOfDay(query.checkOut);

    // Rooms that have overlapping reservations
    const overlappingReservations = await this.prisma.reservation.findMany({
      where: {
        organizationId: query.organizationId,
        hotelId: query.hotelId,
        status: { in: ACTIVE_RESERVATION_STATUSES },
        checkInDate: { lt: checkOut },
        checkOutDate: { gt: checkIn },
        ...(query.excludeReservationId
          ? { id: { not: query.excludeReservationId } }
          : {}),
      },
      select: { roomId: true },
    });

    const reservedRoomIds = new Set(
      overlappingReservations.map((r) => r.roomId).filter((id): id is string => !!id)
    );

    // Rooms blocked by maintenance/other blocks
    const overlappingBlocks = await this.prisma.roomBlock.findMany({
      where: {
        room: { organizationId: query.organizationId, hotelId: query.hotelId },
        startDate: { lte: checkOut },
        OR: [{ endDate: null }, { endDate: { gte: checkIn } }],
      },
      select: { roomId: true },
    });
    const blockedRoomIds = new Set(overlappingBlocks.map((b) => b.roomId));

    const roomTypeFilter = query.roomTypeId
      ? { roomTypeId: query.roomTypeId }
      : {};

    const rooms = await this.prisma.room.findMany({
      where: {
        organizationId: query.organizationId,
        hotelId: query.hotelId,
        ...roomTypeFilter,
        status: {
          notIn: [RoomOperationalStatus.OUT_OF_ORDER, RoomOperationalStatus.OUT_OF_SERVICE],
        },
        ...(query.adults
          ? { roomType: { adultsCapacity: { gte: query.adults } } }
          : {}),
      },
      include: { roomType: true },
      orderBy: { roomNumber: 'asc' },
    });

    const available = rooms.filter((room) => {
      const isReserved = reservedRoomIds.has(room.id);
      const isBlocked = blockedRoomIds.has(room.id);
      return !isReserved && !isBlocked;
    });

    return available.map((room) => ({
      id: room.id,
      roomNumber: room.roomNumber,
      floorId: room.floorId,
      roomTypeId: room.roomTypeId,
      roomTypeName: room.roomType.name,
      capacity: room.roomType.capacity,
      basePrice: Number(room.roomType.basePrice),
      status: room.status,
    }));
  }

  /**
   * Checks whether a single room is available for the date range.
   */
  async isRoomAvailable(
    roomId: string,
    checkIn: Date,
    checkOut: Date,
    excludeReservationId?: string
  ): Promise<boolean> {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) return false;

    if (
      room.status === RoomOperationalStatus.OUT_OF_ORDER ||
      room.status === RoomOperationalStatus.OUT_OF_SERVICE
    ) {
      return false;
    }

    const cIn = startOfDay(checkIn);
    const cOut = startOfDay(checkOut);

    const conflict = await this.prisma.reservation.findFirst({
      where: {
        roomId,
        status: { in: ACTIVE_RESERVATION_STATUSES },
        checkInDate: { lt: cOut },
        checkOutDate: { gt: cIn },
        ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
      },
      select: { id: true },
    });

    if (conflict) return false;

    const block = await this.prisma.roomBlock.findFirst({
      where: {
        roomId,
        startDate: { lte: cOut },
        OR: [{ endDate: null }, { endDate: { gte: cIn } }],
      },
      select: { id: true },
    });

    return !block;
  }

  /**
   * Counts available rooms per night for a hotel over a range.
   */
  async availabilityCalendar(
    organizationId: string,
    hotelId: string,
    from: Date,
    to: Date
  ) {
    const days: { date: string; totalRooms: number; availableRooms: number; occupiedRooms: number; occupancy: number }[] = [];
    const totalRooms = await this.prisma.room.count({
      where: {
        organizationId,
        hotelId,
        status: { notIn: [RoomOperationalStatus.OUT_OF_SERVICE] },
      },
    });

    const activeReservations = await this.prisma.reservation.findMany({
      where: {
        organizationId,
        hotelId,
        status: { in: ACTIVE_RESERVATION_STATUSES },
        checkInDate: { lt: to },
        checkOutDate: { gt: from },
      },
      select: { checkInDate: true, checkOutDate: true, roomId: true },
    });

    let cursor = startOfDay(from);
    while (cursor < to) {
      const next = new Date(cursor);
      next.setDate(next.getDate() + 1);

      let occupied = 0;
      for (const res of activeReservations) {
        if (datesOverlap(res.checkInDate, res.checkOutDate, cursor, next)) {
          occupied += 1;
        }
      }
      const available = Math.max(0, totalRooms - occupied);
      days.push({
        date: cursor.toISOString().slice(0, 10),
        totalRooms,
        availableRooms: available,
        occupiedRooms: occupied,
        occupancy: totalRooms > 0 ? Math.round((occupied / totalRooms) * 1000) / 10 : 0,
      });
      cursor = next;
    }

    return days;
  }

  /**
   * Acquires a PostgreSQL advisory lock for a room within a transaction
   * to prevent concurrent double-booking.
   */
  async lockRoom(prisma: Prisma.TransactionClient, roomId: string): Promise<void> {
    const hash = this.hashRoomId(roomId);
    await prisma.$executeRaw`SELECT pg_advisory_xact_lock(${hash})`;
  }

  private hashRoomId(roomId: string): number {
    let hash = 0;
    for (let i = 0; i < roomId.length; i++) {
      hash = (hash * 31 + roomId.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }
}