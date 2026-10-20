import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Prisma, UserRole } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
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

class CreateRatePlanDto {
  @ApiProperty({ example: 'Standard' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 150.0 })
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  @Min(0)
  basePrice: number;

  @ApiProperty({ example: 'Free cancellation 48 hours before arrival' })
  @IsString()
  @IsNotEmpty()
  cancellationPolicy: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  minimumStay?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  maximumStay?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isRefundable?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  roomTypeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hotelId?: string;
}

class UpdateRatePlanDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  @Min(0)
  basePrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cancellationPolicy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  minimumStay?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  maximumStay?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRefundable?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  roomTypeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hotelId?: string;
}

class CreateTaxRateDto {
  @ApiProperty({ example: 'VAT' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 10.0 })
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  @Min(0)
  rate: number;

  @ApiPropertyOptional({ default: 'PERCENTAGE' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hotelId?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

class UpdateTaxRateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  @Min(0)
  rate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hotelId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

class CreatePromoCodeDto {
  @ApiProperty({ example: 'SUMMER20' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: 'PERCENTAGE' })
  @IsOptional()
  @IsString()
  discountType?: string;

  @ApiProperty({ example: 20 })
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  @Min(0)
  discountValue: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  @Min(0)
  minAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  usageLimit?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hotelId?: string;
}

class UpdatePromoCodeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  discountType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  @Min(0)
  discountValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  @Min(0)
  minAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  usageLimit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hotelId?: string;
}

class CreateSeasonalPricingDto {
  @ApiProperty({ example: 'Summer Peak' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsDateString()
  startDate: string;

  @ApiProperty()
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({ default: 'PERCENTAGE' })
  @IsOptional()
  @IsString()
  adjustmentType?: string;

  @ApiProperty({ example: 15.0 })
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  adjustment: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  roomTypeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ratePlanId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hotelId?: string;
}

class UpdateSeasonalPricingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  adjustmentType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  adjustment?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  roomTypeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ratePlanId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hotelId?: string;
}

const WRITE_ROLES: UserRole[] = [
  UserRole.OWNER,
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER,
  UserRole.HOTEL_MANAGER,
];

const READ_ROLES: UserRole[] = [
  ...WRITE_ROLES,
  UserRole.FRONT_DESK,
  UserRole.RESERVATION_AGENT,
  UserRole.ACCOUNTANT,
];

@ApiTags('rate-plans')
@Controller('rate-plans')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RatePlansController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  @Get()
  @Roles(...READ_ROLES)
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('hotelId') hotelId?: string,
    @Query('roomTypeId') roomTypeId?: string,
    @Query('active') active?: string
  ) {
    const p = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const ps = Math.min(100, Math.max(1, parseInt(pageSize ?? '20', 10) || 20));
    const where: Record<string, unknown> = {
      organizationId: user.organizationId,
    };
    if (hotelId) where.hotelId = hotelId;
    if (roomTypeId) where.roomTypeId = roomTypeId;
    if (active !== undefined) where.active = active === 'true';

    const [items, total] = await Promise.all([
      this.prisma.ratePlan.findMany({
        where,
        skip: (p - 1) * ps,
        take: ps,
        orderBy: { name: 'asc' },
        include: { roomType: true },
      }),
      this.prisma.ratePlan.count({ where }),
    ]);

    return { items, total, page: p, pageSize: ps };
  }

  @Get('taxes/list')
  @Roles(...READ_ROLES)
  async listTaxRates(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('hotelId') hotelId?: string,
    @Query('active') active?: string
  ) {
    const p = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const ps = Math.min(100, Math.max(1, parseInt(pageSize ?? '20', 10) || 20));
    const where: Record<string, unknown> = {
      organizationId: user.organizationId,
    };
    if (hotelId) where.hotelId = hotelId;
    if (active !== undefined) where.active = active === 'true';

    const [items, total] = await Promise.all([
      this.prisma.taxRate.findMany({
        where,
        skip: (p - 1) * ps,
        take: ps,
        orderBy: { name: 'asc' },
      }),
      this.prisma.taxRate.count({ where }),
    ]);

    return { items, total, page: p, pageSize: ps };
  }

  @Get('promo-codes/list')
  @Roles(...READ_ROLES)
  async listPromoCodes(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('hotelId') hotelId?: string,
    @Query('active') active?: string
  ) {
    const p = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const ps = Math.min(100, Math.max(1, parseInt(pageSize ?? '20', 10) || 20));
    const where: Record<string, unknown> = {
      organizationId: user.organizationId,
    };
    if (hotelId) where.hotelId = hotelId;
    if (active !== undefined) where.active = active === 'true';

    const [items, total] = await Promise.all([
      this.prisma.promoCode.findMany({
        where,
        skip: (p - 1) * ps,
        take: ps,
        orderBy: { code: 'asc' },
      }),
      this.prisma.promoCode.count({ where }),
    ]);

    return { items, total, page: p, pageSize: ps };
  }

  @Get('seasonal/list')
  @Roles(...READ_ROLES)
  async listSeasonalPricing(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('hotelId') hotelId?: string,
    @Query('roomTypeId') roomTypeId?: string,
    @Query('ratePlanId') ratePlanId?: string
  ) {
    const p = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const ps = Math.min(100, Math.max(1, parseInt(pageSize ?? '20', 10) || 20));
    const where: Record<string, unknown> = {
      organizationId: user.organizationId,
    };
    if (hotelId) where.hotelId = hotelId;
    if (roomTypeId) where.roomTypeId = roomTypeId;
    if (ratePlanId) where.ratePlanId = ratePlanId;

    const [items, total] = await Promise.all([
      this.prisma.seasonalPricing.findMany({
        where,
        skip: (p - 1) * ps,
        take: ps,
        orderBy: { startDate: 'desc' },
      }),
      this.prisma.seasonalPricing.count({ where }),
    ]);

    return { items, total, page: p, pageSize: ps };
  }

  @Get(':id')
  @Roles(...READ_ROLES)
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    const ratePlan = await this.prisma.ratePlan.findFirst({
      where: { id, organizationId: user.organizationId },
      include: { roomType: true },
    });
    if (!ratePlan) throw new NotFoundException('Rate plan not found');
    return ratePlan;
  }

  @Post()
  @Roles(...WRITE_ROLES)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRatePlanDto
  ) {
    if (dto.hotelId) {
      const hotel = await this.prisma.hotel.findFirst({
        where: { id: dto.hotelId, organizationId: user.organizationId },
      });
      if (!hotel) throw new NotFoundException('Hotel not found');
    }
    if (dto.roomTypeId) {
      const roomType = await this.prisma.roomType.findFirst({
        where: { id: dto.roomTypeId, organizationId: user.organizationId },
      });
      if (!roomType) throw new NotFoundException('Room type not found');
    }

    const ratePlan = await this.prisma.ratePlan.create({
      data: {
        organizationId: user.organizationId,
        name: dto.name,
        description: dto.description,
        basePrice: dto.basePrice,
        cancellationPolicy: dto.cancellationPolicy,
        minimumStay: dto.minimumStay ?? 1,
        maximumStay: dto.maximumStay,
        isRefundable: dto.isRefundable ?? true,
        active: dto.active ?? true,
        roomTypeId: dto.roomTypeId,
        hotelId: dto.hotelId,
      },
    });
    await this.auditService.record(user.id, user.organizationId, 'CREATE', 'RatePlan', ratePlan.id, {
      newValue: { name: ratePlan.name },
    });
    return ratePlan;
  }

  @Patch(':id')
  @Roles(...WRITE_ROLES)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateRatePlanDto
  ) {
    const existing = await this.prisma.ratePlan.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) throw new NotFoundException('Rate plan not found');

    const data: Prisma.RatePlanUncheckedUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.basePrice !== undefined) data.basePrice = dto.basePrice;
    if (dto.cancellationPolicy !== undefined) {
      data.cancellationPolicy = dto.cancellationPolicy;
    }
    if (dto.minimumStay !== undefined) data.minimumStay = dto.minimumStay;
    if (dto.maximumStay !== undefined) data.maximumStay = dto.maximumStay;
    if (dto.isRefundable !== undefined) data.isRefundable = dto.isRefundable;
    if (dto.active !== undefined) data.active = dto.active;
    if (dto.roomTypeId !== undefined) data.roomTypeId = dto.roomTypeId;
    if (dto.hotelId !== undefined) data.hotelId = dto.hotelId;

    const ratePlan = await this.prisma.ratePlan.update({ where: { id }, data });
    await this.auditService.record(user.id, user.organizationId, 'UPDATE', 'RatePlan', id, {
      oldValue: { name: existing.name },
      newValue: { name: ratePlan.name },
    });
    return ratePlan;
  }

  @Delete(':id')
  @Roles(...WRITE_ROLES)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    const existing = await this.prisma.ratePlan.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) throw new NotFoundException('Rate plan not found');

    const ratePlan = await this.prisma.ratePlan.update({
      where: { id },
      data: { active: false },
    });
    await this.auditService.record(user.id, user.organizationId, 'DELETE', 'RatePlan', id, {
      oldValue: { name: existing.name },
    });
    return ratePlan;
  }

  @Post('taxes')
  @Roles(...WRITE_ROLES)
  async createTaxRate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTaxRateDto
  ) {
    const existing = await this.prisma.taxRate.findFirst({
      where: { organizationId: user.organizationId, name: dto.name },
    });
    if (existing) {
      throw new BadRequestException('A tax rate with this name already exists');
    }

    const taxRate = await this.prisma.taxRate.create({
      data: {
        organizationId: user.organizationId,
        name: dto.name,
        rate: dto.rate,
        type: dto.type ?? 'PERCENTAGE',
        hotelId: dto.hotelId,
        active: dto.active ?? true,
      },
    });
    await this.auditService.record(user.id, user.organizationId, 'CREATE', 'TaxRate', taxRate.id, {
      newValue: { name: taxRate.name },
    });
    return taxRate;
  }

  @Patch('taxes/:id')
  @Roles(...WRITE_ROLES)
  async updateTaxRate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTaxRateDto
  ) {
    const existing = await this.prisma.taxRate.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) throw new NotFoundException('Tax rate not found');

    if (dto.name) {
      const duplicate = await this.prisma.taxRate.findFirst({
        where: { organizationId: user.organizationId, name: dto.name, id: { not: id } },
      });
      if (duplicate) {
        throw new BadRequestException('A tax rate with this name already exists');
      }
    }

    const data: Prisma.TaxRateUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.rate !== undefined) data.rate = dto.rate;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.hotelId !== undefined) data.hotelId = dto.hotelId;
    if (dto.active !== undefined) data.active = dto.active;

    const taxRate = await this.prisma.taxRate.update({ where: { id }, data });
    await this.auditService.record(user.id, user.organizationId, 'UPDATE', 'TaxRate', id, {
      oldValue: { name: existing.name },
      newValue: { name: taxRate.name },
    });
    return taxRate;
  }

  @Delete('taxes/:id')
  @Roles(...WRITE_ROLES)
  async removeTaxRate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    const existing = await this.prisma.taxRate.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) throw new NotFoundException('Tax rate not found');

    await this.prisma.taxRate.delete({ where: { id } });
    await this.auditService.record(user.id, user.organizationId, 'DELETE', 'TaxRate', id, {
      oldValue: { name: existing.name },
    });
    return { success: true };
  }

  @Post('promo-codes')
  @Roles(...WRITE_ROLES)
  async createPromoCode(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePromoCodeDto
  ) {
    const existing = await this.prisma.promoCode.findFirst({
      where: {
        organizationId: user.organizationId,
        code: { equals: dto.code, mode: 'insensitive' },
      },
    });
    if (existing) throw new BadRequestException('Promo code already exists');

    const promoCode = await this.prisma.promoCode.create({
      data: {
        organizationId: user.organizationId,
        code: dto.code,
        description: dto.description,
        discountType: dto.discountType ?? 'PERCENTAGE',
        discountValue: dto.discountValue,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validTo: dto.validTo ? new Date(dto.validTo) : undefined,
        minAmount: dto.minAmount,
        usageLimit: dto.usageLimit,
        hotelId: dto.hotelId,
        active: dto.active ?? true,
      },
    });
    await this.auditService.record(user.id, user.organizationId, 'CREATE', 'PromoCode', promoCode.id, {
      newValue: { code: promoCode.code },
    });
    return promoCode;
  }

  @Patch('promo-codes/:id')
  @Roles(...WRITE_ROLES)
  async updatePromoCode(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdatePromoCodeDto
  ) {
    const existing = await this.prisma.promoCode.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) throw new NotFoundException('Promo code not found');

    if (dto.code) {
      const duplicate = await this.prisma.promoCode.findFirst({
        where: {
          organizationId: user.organizationId,
          code: { equals: dto.code, mode: 'insensitive' },
          id: { not: id },
        },
      });
      if (duplicate) throw new BadRequestException('Promo code already exists');
    }

    const data: Prisma.PromoCodeUpdateInput = {};
    if (dto.code !== undefined) data.code = dto.code;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.discountType !== undefined) data.discountType = dto.discountType;
    if (dto.discountValue !== undefined) data.discountValue = dto.discountValue;
    if (dto.validFrom !== undefined) data.validFrom = new Date(dto.validFrom);
    if (dto.validTo !== undefined) data.validTo = new Date(dto.validTo);
    if (dto.minAmount !== undefined) data.minAmount = dto.minAmount;
    if (dto.usageLimit !== undefined) data.usageLimit = dto.usageLimit;
    if (dto.hotelId !== undefined) data.hotelId = dto.hotelId;
    if (dto.active !== undefined) data.active = dto.active;

    const promoCode = await this.prisma.promoCode.update({ where: { id }, data });
    await this.auditService.record(user.id, user.organizationId, 'UPDATE', 'PromoCode', id, {
      oldValue: { code: existing.code },
      newValue: { code: promoCode.code },
    });
    return promoCode;
  }

  @Delete('promo-codes/:id')
  @Roles(...WRITE_ROLES)
  async removePromoCode(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    const existing = await this.prisma.promoCode.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) throw new NotFoundException('Promo code not found');

    await this.prisma.promoCode.delete({ where: { id } });
    await this.auditService.record(user.id, user.organizationId, 'DELETE', 'PromoCode', id, {
      oldValue: { code: existing.code },
    });
    return { success: true };
  }

  @Post('seasonal')
  @Roles(...WRITE_ROLES)
  async createSeasonalPricing(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSeasonalPricingDto
  ) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (endDate < startDate) {
      throw new BadRequestException('endDate must be on or after startDate');
    }

    const seasonalPricing = await this.prisma.seasonalPricing.create({
      data: {
        organizationId: user.organizationId,
        name: dto.name,
        startDate,
        endDate,
        adjustmentType: dto.adjustmentType ?? 'PERCENTAGE',
        adjustment: dto.adjustment,
        roomTypeId: dto.roomTypeId,
        ratePlanId: dto.ratePlanId,
        hotelId: dto.hotelId,
      },
    });
    await this.auditService.record(user.id, user.organizationId, 'CREATE', 'SeasonalPricing', seasonalPricing.id, {
      newValue: { name: seasonalPricing.name },
    });
    return seasonalPricing;
  }

  @Patch('seasonal/:id')
  @Roles(...WRITE_ROLES)
  async updateSeasonalPricing(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateSeasonalPricingDto
  ) {
    const existing = await this.prisma.seasonalPricing.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) throw new NotFoundException('Seasonal pricing not found');

    const data: Prisma.SeasonalPricingUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.startDate !== undefined) data.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) data.endDate = new Date(dto.endDate);
    if (dto.adjustmentType !== undefined) data.adjustmentType = dto.adjustmentType;
    if (dto.adjustment !== undefined) data.adjustment = dto.adjustment;
    if (dto.roomTypeId !== undefined) data.roomTypeId = dto.roomTypeId;
    if (dto.ratePlanId !== undefined) data.ratePlanId = dto.ratePlanId;
    if (dto.hotelId !== undefined) data.hotelId = dto.hotelId;

    const seasonalPricing = await this.prisma.seasonalPricing.update({ where: { id }, data });
    await this.auditService.record(user.id, user.organizationId, 'UPDATE', 'SeasonalPricing', id, {
      oldValue: { name: existing.name },
      newValue: { name: seasonalPricing.name },
    });
    return seasonalPricing;
  }

  @Delete('seasonal/:id')
  @Roles(...WRITE_ROLES)
  async removeSeasonalPricing(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    const existing = await this.prisma.seasonalPricing.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) throw new NotFoundException('Seasonal pricing not found');

    await this.prisma.seasonalPricing.delete({ where: { id } });
    await this.auditService.record(user.id, user.organizationId, 'DELETE', 'SeasonalPricing', id, {
      oldValue: { name: existing.name },
    });
    return { success: true };
  }
}