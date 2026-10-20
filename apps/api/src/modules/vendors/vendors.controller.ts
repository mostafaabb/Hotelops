import {
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
import { Prisma, UserRole, VendorStatus } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
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

class CreateVendorDto {
  @ApiProperty({ example: 'Bekaa Fresh Produce' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactPerson?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

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
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ enum: VendorStatus })
  @IsOptional()
  @IsEnum(VendorStatus)
  status?: VendorStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hotelId?: string;
}

class UpdateVendorDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactPerson?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

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
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ enum: VendorStatus })
  @IsOptional()
  @IsEnum(VendorStatus)
  status?: VendorStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hotelId?: string;
}

const READ_ROLES: UserRole[] = [
  UserRole.OWNER,
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER,
  UserRole.HOTEL_MANAGER,
  UserRole.ACCOUNTANT,
];

const WRITE_ROLES: UserRole[] = [
  UserRole.OWNER,
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER,
  UserRole.HOTEL_MANAGER,
  UserRole.ACCOUNTANT,
];

@ApiTags('vendors')
@Controller('vendors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VendorsController {
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
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('hotelId') hotelId?: string
  ) {
    const p = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const ps = Math.min(100, Math.max(1, parseInt(pageSize ?? '20', 10) || 20));
    const where: Record<string, unknown> = {
      organizationId: user.organizationId,
    };
    if (search) where.name = { contains: search, mode: 'insensitive' };
    if (category) where.category = { contains: category, mode: 'insensitive' };
    if (status) where.status = status;
    if (hotelId) where.hotelId = hotelId;

    const vendors = await this.prisma.vendor.findMany({
      where,
      skip: (p - 1) * ps,
      take: ps,
      orderBy: { name: 'asc' },
      include: { _count: { select: { expenses: true } } },
    });
    const [total, groups] = await Promise.all([
      this.prisma.vendor.count({ where }),
      vendors.length
        ? this.prisma.expense.groupBy({
            by: ['vendorId'],
            where: {
              organizationId: user.organizationId,
              vendorId: { in: vendors.map((v) => v.id) },
            },
            _sum: { amount: true },
          })
        : Promise.resolve([]),
    ]);

    const totals: Record<string, number> = {};
    for (const group of groups) {
      if (group.vendorId) {
        totals[group.vendorId] = group._sum.amount ? group._sum.amount.toNumber() : 0;
      }
    }

    const items = vendors.map((vendor) => {
      const { _count, ...data } = vendor;
      return {
        ...data,
        expenseCount: _count.expenses,
        totalExpenses: totals[vendor.id] ?? 0,
      };
    });

    return { items, total, page: p, pageSize: ps };
  }

  @Get(':id')
  @Roles(...READ_ROLES)
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { id, organizationId: user.organizationId },
      include: { expenses: { orderBy: { date: 'desc' }, take: 10 } },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');
    return vendor;
  }

  @Post()
  @Roles(...WRITE_ROLES)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateVendorDto
  ) {
    if (dto.hotelId) {
      const hotel = await this.prisma.hotel.findFirst({
        where: { id: dto.hotelId, organizationId: user.organizationId },
      });
      if (!hotel) throw new NotFoundException('Hotel not found');
    }

    const vendor = await this.prisma.vendor.create({
      data: {
        organizationId: user.organizationId,
        name: dto.name,
        contactPerson: dto.contactPerson,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        category: dto.category,
        notes: dto.notes,
        status: dto.status ?? VendorStatus.ACTIVE,
        hotelId: dto.hotelId,
      },
    });
    await this.auditService.record(user.id, user.organizationId, 'CREATE', 'Vendor', vendor.id, {
      newValue: { name: vendor.name },
    });
    return vendor;
  }

  @Patch(':id')
  @Roles(...WRITE_ROLES)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateVendorDto
  ) {
    const existing = await this.prisma.vendor.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) throw new NotFoundException('Vendor not found');

    const data: Prisma.VendorUncheckedUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.contactPerson !== undefined) data.contactPerson = dto.contactPerson;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.hotelId !== undefined) data.hotelId = dto.hotelId;

    const vendor = await this.prisma.vendor.update({ where: { id }, data });
    await this.auditService.record(user.id, user.organizationId, 'UPDATE', 'Vendor', id, {
      oldValue: { name: existing.name },
      newValue: { name: vendor.name },
    });
    return vendor;
  }

  @Delete(':id')
  @Roles(...WRITE_ROLES)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    const existing = await this.prisma.vendor.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) throw new NotFoundException('Vendor not found');

    const vendor = await this.prisma.vendor.update({
      where: { id },
      data: { status: VendorStatus.INACTIVE },
    });
    await this.auditService.record(user.id, user.organizationId, 'DELETE', 'Vendor', id, {
      oldValue: { name: existing.name },
    });
    return vendor;
  }
}