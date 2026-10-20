import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AvailabilityService } from './availability.service';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('availability')
@Controller('availability')
export class AvailabilityController {
  constructor(
    private readonly availabilityService: AvailabilityService,
    private readonly prisma: PrismaService
  ) {}

  @Get('rooms')
  async findAvailable(
    @CurrentUser() user: AuthenticatedUser,
    @Query('checkIn') checkIn: string,
    @Query('checkOut') checkOut: string,
    @Query('roomTypeId') roomTypeId?: string,
    @Query('hotelId') hotelId?: string,
    @Query('adults') adults?: number,
    @Query('children') children?: number
  ) {
    const resolvedHotelId = await this.resolveHotelId(user, hotelId);
    return this.availabilityService.findAvailableRooms({
      organizationId: user.organizationId,
      hotelId: resolvedHotelId,
      checkIn: new Date(checkIn),
      checkOut: new Date(checkOut),
      roomTypeId,
      adults: adults ? Number(adults) : undefined,
      children: children ? Number(children) : undefined,
    });
  }

  @Get('calendar')
  async calendar(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('hotelId') hotelId?: string
  ) {
    const resolvedHotelId = await this.resolveHotelId(user, hotelId);
    return this.availabilityService.availabilityCalendar(
      user.organizationId,
      resolvedHotelId,
      new Date(from),
      new Date(to)
    );
  }

  private async resolveHotelId(user: AuthenticatedUser, requested?: string): Promise<string> {
    if (requested) return requested;
    if (user.hotelId) return user.hotelId;
    const hotel = await this.prisma.hotel.findFirst({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!hotel) throw new Error('No hotels found for organization');
    return hotel.id;
  }
}