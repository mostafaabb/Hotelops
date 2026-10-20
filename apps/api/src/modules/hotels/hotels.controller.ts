import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { HotelStatus, UserRole } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';

class CreateHotelDto {
  @ApiProperty({ example: 'Hotel Beirut' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'beirut-grand' })
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ default: 'UTC' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ default: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ default: '14:00' })
  @IsOptional()
  @IsString()
  checkInTime?: string;

  @ApiPropertyOptional({ default: '11:00' })
  @IsOptional()
  @IsString()
  checkOutTime?: string;

  @ApiPropertyOptional({ enum: HotelStatus, default: HotelStatus.ACTIVE })
  @IsOptional()
  @IsEnum(HotelStatus)
  status?: HotelStatus;

  @ApiPropertyOptional({ minimum: 1, maximum: 7, default: 4 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(7)
  starRating?: number;
}

class UpdateHotelDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  checkInTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  checkOutTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(HotelStatus)
  status?: HotelStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  starRating?: number;
}

@ApiTags('hotels')
@Controller('hotels')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HotelsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN, UserRole.HOTEL_MANAGER, UserRole.FRONT_DESK, UserRole.ACCOUNTANT, UserRole.RESERVATION_AGENT, UserRole.HOUSEKEEPING_MANAGER, UserRole.MAINTENANCE_MANAGER, UserRole.STAFF)
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('includeStats') includeStats?: string
  ) {
    const hotels = await this.prisma.hotel.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { name: 'asc' },
      include: includeStats === 'true' ? {
        _count: { select: { rooms: true, reservations: true, staff: true } },
      } : undefined,
    });
    return hotels.map((h: any) => {
      if (h._count) {
        return {
          ...h,
          totalRooms: h._count.rooms,
          totalReservations: h._count.reservations,
          totalStaff: h._count.staff,
          _count: undefined,
        };
      }
      return h;
    });
  }

  @Get(':id')
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN, UserRole.HOTEL_MANAGER, UserRole.FRONT_DESK, UserRole.ACCOUNTANT, UserRole.RESERVATION_AGENT, UserRole.HOUSEKEEPING_MANAGER, UserRole.MAINTENANCE_MANAGER)
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    const hotel = await this.prisma.hotel.findFirst({
      where: { id, organizationId: user.organizationId },
      include: {
        buildings: { include: { floors: { include: { rooms: true } } } },
        _count: { select: { rooms: true, reservations: true, staff: true, guests: true } },
      },
    });
    if (!hotel) {
      throw new Error('Hotel not found');
    }
    return hotel;
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.SUPER_ADMIN)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateHotelDto
  ) {
    const hotel = await this.prisma.hotel.create({
      data: {
        organizationId: user.organizationId,
        ...(dto as any),
      },
    });
    await this.auditService.record(user.id, user.organizationId, 'CREATE', 'Hotel', hotel.id, {
      newValue: { name: hotel.name },
    });
    return hotel;
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateHotelDto
  ) {
    const existing = await this.prisma.hotel.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) throw new Error('Hotel not found');

    const hotel = await this.prisma.hotel.update({
      where: { id },
      data: dto as any,
    });
    await this.auditService.record(user.id, user.organizationId, 'UPDATE', 'Hotel', id, {
      oldValue: { name: existing.name },
      newValue: { name: hotel.name },
    });
    return hotel;
  }
}