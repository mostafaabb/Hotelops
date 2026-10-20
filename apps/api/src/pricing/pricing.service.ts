import { Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { nightsBetween } from '../common/utils/date.util';
import { roundAmount } from '../common/utils/money.util';

export interface RoomPricingInput {
  roomTypeId: string;
  ratePlanId?: string;
  checkIn: Date;
  checkOut: Date;
  organizationId: string;
  hotelId?: string;
  promoCode?: string;
  guestsCount?: number;
}

export interface PricingBreakdown {
  nights: number;
  ratePerNight: number;
  subtotal: number;
  taxes: number;
  discounts: number;
  total: number;
  taxRates: { name: string; rate: number; amount: number }[];
  promoDiscount: number;
  seasonalityApplied: number;
  averageRate: number;
}

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  async calculate(input: RoomPricingInput): Promise<PricingBreakdown> {
    const { roomTypeId, checkIn, checkOut } = input;
    const nights = nightsBetween(checkIn, checkOut);

    if (nights < 1) {
      throw new Error('Check-out date must be after check-in date');
    }

    const roomType = await this.prisma.roomType.findUnique({
      where: { id: roomTypeId },
    });
    if (!roomType) {
      throw new Error('Room type not found');
    }

    let baseRate;
    if (input.ratePlanId) {
      const ratePlan = await this.prisma.ratePlan.findUnique({
        where: { id: input.ratePlanId },
      });
      baseRate = ratePlan?.basePrice
        ? new Decimal(ratePlan.basePrice.toString()).toNumber()
        : Number(roomType.basePrice);
    } else {
      baseRate = Number(roomType.basePrice);
    }

    // Seasonal adjustments
    let seasonalityApplied = 0;
    const seasonal = await this.prisma.seasonalPricing.findMany({
      where: {
        organizationId: input.organizationId,
        roomTypeId,
        startDate: { lte: checkOut },
        endDate: { gte: checkIn },
      },
    });

    let adjustedNightlyRate = baseRate;
    for (const s of seasonal) {
      const adj = Number(s.adjustment);
      if (s.adjustmentType === 'PERCENTAGE') {
        adjustedNightlyRate += adjustedNightlyRate * (adj / 100);
      } else {
        adjustedNightlyRate += adj;
      }
      seasonalityApplied += adj;
    }

    adjustedNightlyRate = roundAmount(adjustedNightlyRate);
    const subtotal = roundAmount(adjustedNightlyRate * nights);

    // Taxes
    const taxRates = await this.prisma.taxRate.findMany({
      where: {
        organizationId: input.organizationId,
        active: true,
        OR: input.hotelId ? [{ hotelId: input.hotelId }, { hotelId: null }] : [{ hotelId: null }],
      },
    });

    const taxBreakdown = taxRates.map((t) => {
      const rate = Number(t.rate);
      return {
        name: t.name,
        rate,
        amount: roundAmount((subtotal * rate) / 100),
      };
    });
    const taxes = roundAmount(taxBreakdown.reduce((acc, t) => acc + t.amount, 0));

    // Promo code / discounts
    let promoDiscount = 0;
    if (input.promoCode) {
      const promo = await this.prisma.promoCode.findFirst({
        where: { code: input.promoCode },
      });
      if (
        promo &&
        promo.organizationId === input.organizationId &&
        promo.active &&
        (!promo.validFrom || promo.validFrom <= checkIn) &&
        (!promo.validTo || promo.validTo >= checkOut) &&
        (!promo.usageLimit || promo.usageCount < promo.usageLimit)
      ) {
        if (promo.discountType === 'PERCENTAGE') {
          promoDiscount = roundAmount((subtotal * Number(promo.discountValue)) / 100);
        } else {
          promoDiscount = Number(promo.discountValue);
        }
      }
    }

    const discounts = promoDiscount;
    const total = roundAmount(subtotal + taxes - discounts);

    return {
      nights,
      ratePerNight: adjustedNightlyRate,
      subtotal,
      taxes,
      discounts,
      total,
      taxRates: taxBreakdown,
      promoDiscount,
      seasonalityApplied,
      averageRate: roundAmount(total / nights),
    };
  }

  async recalculateReservation(reservationId: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
    });
    if (!reservation) return null;

    const roomTypeId = reservation.roomTypeId || (await this.getFirstRoomType());
    const breakdown = await this.calculate({
      roomTypeId,
      ratePlanId: reservation.ratePlanId || undefined,
      checkIn: reservation.checkInDate,
      checkOut: reservation.checkOutDate,
      organizationId: reservation.organizationId,
      hotelId: reservation.hotelId,
    });

    return this.prisma.reservation.update({
      where: { id: reservationId },
      data: {
        subtotal: breakdown.subtotal,
        taxes: breakdown.taxes,
        discounts: breakdown.discounts,
        total: breakdown.total,
        balance: roundAmount(breakdown.total - Number(reservation.amountPaid)),
      },
      include: { guest: true, room: true, roomType: true, folio: true },
    });
  }

  private async getFirstRoomType(): Promise<string> {
    const rt = await this.prisma.roomType.findFirst();
    if (!rt) throw new Error('No room types exist');
    return rt.id;
  }
}