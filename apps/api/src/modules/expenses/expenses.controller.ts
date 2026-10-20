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
import { ExpenseCategory, PaymentMethod, UserRole } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
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

class CreateExpenseDto {
  @ApiProperty({ enum: ExpenseCategory })
  @IsEnum(ExpenseCategory)
  category: ExpenseCategory;

  @ApiProperty({ example: 250.0 })
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ example: 'Cleaning supplies restock' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vendorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  receiptUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hotelId?: string;
}

class UpdateExpenseDto {
  @ApiPropertyOptional({ enum: ExpenseCategory })
  @IsOptional()
  @IsEnum(ExpenseCategory)
  category?: ExpenseCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vendorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  receiptUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hotelId?: string;
}

const FINANCIAL_ROLES: UserRole[] = [
  UserRole.OWNER,
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER,
  UserRole.ACCOUNTANT,
];

@ApiTags('expenses')
@Controller('expenses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExpensesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  @Get()
  @Roles(...FINANCIAL_ROLES)
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('category') category?: string,
    @Query('vendorId') vendorId?: string,
    @Query('hotelId') hotelId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    const p = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const ps = Math.min(100, Math.max(1, parseInt(pageSize ?? '20', 10) || 20));
    const where: Record<string, unknown> = {
      organizationId: user.organizationId,
    };
    if (category) where.category = category;
    if (vendorId) where.vendorId = vendorId;
    if (hotelId) where.hotelId = hotelId;
    if (from || to) {
      where.date = {};
      if (from) (where.date as Record<string, unknown>).gte = new Date(from);
      if (to) (where.date as Record<string, unknown>).lte = new Date(to);
    }

    const [items, total, aggregate] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        skip: (p - 1) * ps,
        take: ps,
        orderBy: { date: 'desc' },
        include: { vendor: true },
      }),
      this.prisma.expense.count({ where }),
      this.prisma.expense.aggregate({ where, _sum: { amount: true } }),
    ]);

    return {
      items,
      total,
      page: p,
      pageSize: ps,
      totalAmount: aggregate._sum.amount ? aggregate._sum.amount.toNumber() : 0,
    };
  }

  @Get('summary')
  @Roles(...FINANCIAL_ROLES)
  async summary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('hotelId') hotelId?: string
  ) {
    const where: Record<string, unknown> = {
      organizationId: user.organizationId,
    };
    if (hotelId) where.hotelId = hotelId;
    if (from || to) {
      where.date = {};
      if (from) (where.date as Record<string, unknown>).gte = new Date(from);
      if (to) (where.date as Record<string, unknown>).lte = new Date(to);
    }

    const grouped = await this.prisma.expense.groupBy({
      by: ['category'],
      where,
      _sum: { amount: true },
    });

    return grouped.map((g) => ({
      category: g.category,
      total: g._sum.amount ? g._sum.amount.toNumber() : 0,
    }));
  }

  @Get(':id')
  @Roles(...FINANCIAL_ROLES)
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    const expense = await this.prisma.expense.findFirst({
      where: { id, organizationId: user.organizationId },
      include: { vendor: true },
    });
    if (!expense) throw new NotFoundException('Expense not found');
    return expense;
  }

  @Post()
  @Roles(...FINANCIAL_ROLES)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateExpenseDto
  ) {
    const hotelId = dto.hotelId ?? user.hotelId;
    if (!hotelId) throw new BadRequestException('hotelId is required');

    const hotel = await this.prisma.hotel.findFirst({
      where: { id: hotelId, organizationId: user.organizationId },
    });
    if (!hotel) throw new NotFoundException('Hotel not found');

    if (dto.vendorId) {
      const vendor = await this.prisma.vendor.findFirst({
        where: { id: dto.vendorId, organizationId: user.organizationId },
      });
      if (!vendor) throw new NotFoundException('Vendor not found');
    }

    const expense = await this.prisma.expense.create({
      data: {
        organizationId: user.organizationId,
        hotelId,
        category: dto.category,
        amount: dto.amount,
        description: dto.description,
        vendorId: dto.vendorId,
        date: dto.date ? new Date(dto.date) : undefined,
        paymentMethod: dto.paymentMethod,
        receiptUrl: dto.receiptUrl,
        createdBy: user.id,
      },
    });
    await this.auditService.record(user.id, user.organizationId, 'CREATE', 'Expense', expense.id, {
      newValue: { category: expense.category, amount: expense.amount.toNumber() },
    });
    return expense;
  }

  @Patch(':id')
  @Roles(...FINANCIAL_ROLES)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto
  ) {
    const existing = await this.prisma.expense.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) throw new NotFoundException('Expense not found');

    const expense = await this.prisma.expense.update({
      where: { id },
      data: {
        category: dto.category,
        amount: dto.amount,
        description: dto.description,
        vendorId: dto.vendorId,
        date: dto.date ? new Date(dto.date) : undefined,
        paymentMethod: dto.paymentMethod,
        receiptUrl: dto.receiptUrl,
        hotelId: dto.hotelId,
      },
    });
    await this.auditService.record(user.id, user.organizationId, 'UPDATE', 'Expense', id, {
      oldValue: { description: existing.description },
      newValue: { description: expense.description },
    });
    return expense;
  }

  @Delete(':id')
  @Roles(...FINANCIAL_ROLES)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    const existing = await this.prisma.expense.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) throw new NotFoundException('Expense not found');

    await this.prisma.expense.delete({ where: { id } });
    await this.auditService.record(user.id, user.organizationId, 'DELETE', 'Expense', id, {
      oldValue: { description: existing.description },
    });
    return { success: true };
  }
}