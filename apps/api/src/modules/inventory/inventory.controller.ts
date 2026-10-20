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
import { Prisma, StockMovementType, UserRole } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
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
import { InventoryService } from './inventory.service';

class CreateProductDto {
  @ApiProperty({ example: 'Toilet Paper Roll' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'TP-001' })
  @IsString()
  @IsNotEmpty()
  sku: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional({ default: 5 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(0)
  minimumStock?: number;

  @ApiPropertyOptional({ default: 'pcs' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  @Min(0)
  cost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  supplier?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hotelId?: string;
}

class UpdateProductDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  sku?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(0)
  minimumStock?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  @Min(0)
  cost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  supplier?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hotelId?: string;
}

class CreateMovementDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ enum: StockMovementType })
  @IsEnum(StockMovementType)
  type: StockMovementType;

  @ApiProperty({ example: 10 })
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(0)
  quantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reference?: string;
}

const READ_ROLES: UserRole[] = [
  UserRole.OWNER,
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER,
  UserRole.HOTEL_MANAGER,
  UserRole.ACCOUNTANT,
  UserRole.HOUSEKEEPING_MANAGER,
  UserRole.MAINTENANCE_MANAGER,
  UserRole.FRONT_DESK,
  UserRole.RESERVATION_AGENT,
  UserRole.STAFF,
];

const WRITE_ROLES: UserRole[] = [
  UserRole.OWNER,
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER,
  UserRole.HOTEL_MANAGER,
  UserRole.ACCOUNTANT,
  UserRole.HOUSEKEEPING_MANAGER,
  UserRole.MAINTENANCE_MANAGER,
];

@ApiTags('inventory')
@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly auditService: AuditService
  ) {}

  @Get('products')
  @Roles(...READ_ROLES)
  async findAllProducts(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('lowStock') lowStock?: string
  ) {
    const p = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const ps = Math.min(100, Math.max(1, parseInt(pageSize ?? '20', 10) || 20));
    const where: Record<string, unknown> = {
      organizationId: user.organizationId,
    };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (category) where.category = { contains: category, mode: 'insensitive' };
    if (lowStock === 'true') {
      where.quantity = { lte: this.prisma.inventoryProduct.fields.minimumStock };
    }

    const [items, total] = await Promise.all([
      this.prisma.inventoryProduct.findMany({
        where,
        skip: (p - 1) * ps,
        take: ps,
        orderBy: { name: 'asc' },
      }),
      this.prisma.inventoryProduct.count({ where }),
    ]);

    return {
      items: items.map((product) => ({
        ...product,
        isLowStock: product.quantity <= product.minimumStock,
      })),
      total,
      page: p,
      pageSize: ps,
    };
  }

  @Get('products/:id')
  @Roles(...READ_ROLES)
  async findOneProduct(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    const product = await this.prisma.inventoryProduct.findFirst({
      where: { id, organizationId: user.organizationId },
      include: {
        movements: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            performedByUser: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  @Post('products')
  @Roles(...WRITE_ROLES)
  async createProduct(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProductDto
  ) {
    const existing = await this.prisma.inventoryProduct.findFirst({
      where: { organizationId: user.organizationId, sku: dto.sku },
    });
    if (existing) {
      throw new BadRequestException('A product with this SKU already exists');
    }

    if (dto.hotelId) {
      const hotel = await this.prisma.hotel.findFirst({
        where: { id: dto.hotelId, organizationId: user.organizationId },
      });
      if (!hotel) throw new NotFoundException('Hotel not found');
    }

    const product = await this.prisma.inventoryProduct.create({
      data: {
        organizationId: user.organizationId,
        name: dto.name,
        sku: dto.sku,
        category: dto.category,
        quantity: dto.quantity ?? 0,
        minimumStock: dto.minimumStock ?? 5,
        unit: dto.unit ?? 'pcs',
        cost: dto.cost,
        supplier: dto.supplier,
        location: dto.location,
        hotelId: dto.hotelId,
      },
    });
    await this.auditService.record(user.id, user.organizationId, 'CREATE', 'InventoryProduct', product.id, {
      newValue: { name: product.name, sku: product.sku },
    });
    return product;
  }

  @Patch('products/:id')
  @Roles(...WRITE_ROLES)
  async updateProduct(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto
  ) {
    const existing = await this.prisma.inventoryProduct.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) throw new NotFoundException('Product not found');

    const data: Prisma.InventoryProductUncheckedUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.sku !== undefined) data.sku = dto.sku;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.quantity !== undefined) data.quantity = dto.quantity;
    if (dto.minimumStock !== undefined) data.minimumStock = dto.minimumStock;
    if (dto.unit !== undefined) data.unit = dto.unit;
    if (dto.cost !== undefined) data.cost = dto.cost;
    if (dto.supplier !== undefined) data.supplier = dto.supplier;
    if (dto.location !== undefined) data.location = dto.location;
    if (dto.hotelId !== undefined) data.hotelId = dto.hotelId;

    const product = await this.prisma.inventoryProduct.update({ where: { id }, data });
    await this.auditService.record(user.id, user.organizationId, 'UPDATE', 'InventoryProduct', id, {
      oldValue: { name: existing.name },
      newValue: { name: product.name },
    });
    return product;
  }

  @Delete('products/:id')
  @Roles(...WRITE_ROLES)
  async removeProduct(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    const existing = await this.prisma.inventoryProduct.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) throw new NotFoundException('Product not found');

    await this.prisma.inventoryProduct.delete({ where: { id } });
    await this.auditService.record(user.id, user.organizationId, 'DELETE', 'InventoryProduct', id, {
      oldValue: { name: existing.name },
    });
    return { success: true };
  }

  @Get('movements')
  @Roles(...READ_ROLES)
  async findAllMovements(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('productId') productId?: string,
    @Query('type') type?: string
  ) {
    const p = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const ps = Math.min(100, Math.max(1, parseInt(pageSize ?? '20', 10) || 20));
    const where: Record<string, unknown> = {
      organizationId: user.organizationId,
    };
    if (productId) where.productId = productId;
    if (type) where.type = type;

    const [items, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        skip: (p - 1) * ps,
        take: ps,
        orderBy: { createdAt: 'desc' },
        include: { product: true },
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return { items, total, page: p, pageSize: ps };
  }

  @Post('movements')
  @Roles(...WRITE_ROLES)
  async createMovement(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMovementDto
  ) {
    return this.inventoryService.createMovement(user, dto);
  }
}