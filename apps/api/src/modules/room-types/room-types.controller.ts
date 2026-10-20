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
import { RoomTypeStatus, UserRole } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
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

class CreateRoomTypeDto {
  @ApiProperty({ example: 'Deluxe Suite' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'DLX' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: 2 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(20)
  capacity?: number;

  @ApiPropertyOptional({ default: 2 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  adultsCapacity?: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(0)
  childrenCapacity?: number;

  @ApiProperty({ example: 150 })
  @IsNumber()
  basePrice: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  size?: number;

  @ApiPropertyOptional({ example: '1 King, 1 Twin' })
  @IsOptional()
  @IsString()
  bedConfiguration?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenityIds?: string[];

  @ApiPropertyOptional({ example: 'HOTEL_001' })
  @IsOptional()
  @IsString()
  hotelId?: string;

  @ApiPropertyOptional({ enum: RoomTypeStatus, default: RoomTypeStatus.ACTIVE })
  @IsOptional()
  @IsEnum(RoomTypeStatus)
  status?: RoomTypeStatus;
}

class UpdateRoomTypeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(20)
  capacity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  adultsCapacity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(0)
  childrenCapacity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  basePrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  size?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bedConfiguration?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenityIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hotelId?: string;

  @ApiPropertyOptional({ enum: RoomTypeStatus })
  @IsOptional()
  @IsEnum(RoomTypeStatus)
  status?: RoomTypeStatus;
}

const WRITE_ROLES: UserRole[] = [
  UserRole.OWNER,
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER,
  UserRole.HOTEL_MANAGER,
];

@ApiTags('room-types')
@Controller('room-types')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RoomTypesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Roles(...WRITE_ROLES, UserRole.FRONT_DESK, UserRole.RESERVATION_AGENT, UserRole.HOUSEKEEPING_MANAGER, UserRole.MAINTENANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.STAFF)
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('status') status?: RoomTypeStatus,
    @Query('hotelId') hotelId?: string
  ) {
    const p = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const ps = Math.min(100, Math.max(1, parseInt(pageSize ?? '20', 10) || 20));
    const where: Record<string, unknown> = { organizationId: user.organizationId };

    if (status) where.status = status;
    if (hotelId) where.hotelId = hotelId;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.roomType.findMany({
        where,
        skip: (p - 1) * ps,
        take: ps,
        orderBy: { name: 'asc' },
        include: {
          _count: { select: { rooms: true } },
          amenities: { include: { amenity: true } },
        },
      }),
      this.prisma.roomType.count({ where }),
    ]);

    return {
      items: items.map((rt) => ({
        ...rt,
        roomCount: rt._count.rooms,
        amenities: rt.amenities.map((ra) => ra.amenity),
        _count: undefined,
      })),
      total,
      page: p,
      pageSize: ps,
    };
  }

  @Get(':id')
  @Roles(...WRITE_ROLES, UserRole.FRONT_DESK, UserRole.RESERVATION_AGENT, UserRole.HOUSEKEEPING_MANAGER, UserRole.MAINTENANCE_MANAGER, UserRole.ACCOUNTANT, UserRole.STAFF)
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    const roomType = await this.prisma.roomType.findFirst({
      where: { id, organizationId: user.organizationId },
      include: {
        _count: { select: { rooms: true } },
        amenities: { include: { amenity: true } },
      },
    });
    if (!roomType) throw new NotFoundException('Room type not found');
    return {
      ...roomType,
      roomCount: roomType._count.rooms,
      amenities: roomType.amenities.map((ra) => ra.amenity),
      _count: undefined,
    };
  }

  @Post()
  @Roles(...WRITE_ROLES)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRoomTypeDto
  ) {
    const { amenityIds, ...data } = dto;

    const existing = await this.prisma.roomType.findFirst({
      where: { organizationId: user.organizationId, code: data.code },
    });
    if (existing) {
      throw new BadRequestException('A room type with this code already exists');
    }

    const roomType = await this.prisma.roomType.create({
      data: {
        organizationId: user.organizationId,
        name: data.name,
        code: data.code,
        description: data.description,
        capacity: data.capacity ?? 2,
        adultsCapacity: data.adultsCapacity ?? 2,
        childrenCapacity: data.childrenCapacity ?? 1,
        basePrice: data.basePrice ?? 100,
        size: data.size,
        bedConfiguration: data.bedConfiguration,
        images: data.images ?? [],
        hotelId: data.hotelId,
        status: data.status ?? RoomTypeStatus.ACTIVE,
      },
    });

    if (amenityIds && amenityIds.length > 0) {
      await this.prisma.roomTypeAmenity.createMany({
        data: amenityIds.map((amenityId) => ({
          roomTypeId: roomType.id,
          amenityId,
        })),
      });
    }

    return roomType;
  }

  @Patch(':id')
  @Roles(...WRITE_ROLES)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateRoomTypeDto
  ) {
    const existing = await this.prisma.roomType.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) throw new NotFoundException('Room type not found');

    if (dto.code && dto.code !== existing.code) {
      const duplicate = await this.prisma.roomType.findFirst({
        where: {
          organizationId: user.organizationId,
          code: dto.code,
          id: { not: id },
        },
      });
      if (duplicate) {
        throw new BadRequestException('A room type with this code already exists');
      }
    }

    const { amenityIds, ...updateData } = dto;

    const roomType = await this.prisma.roomType.update({
      where: { id },
      data: updateData as never,
    });

    if (amenityIds) {
      await this.prisma.$transaction([
        this.prisma.roomTypeAmenity.deleteMany({ where: { roomTypeId: id } }),
        this.prisma.roomTypeAmenity.createMany({
          data: amenityIds.map((amenityId) => ({
            roomTypeId: id,
            amenityId,
          })),
        }),
      ]);
    }

    return roomType;
  }

  @Delete(':id')
  @Roles(...WRITE_ROLES)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    const existing = await this.prisma.roomType.findFirst({
      where: { id, organizationId: user.organizationId },
      include: { _count: { select: { rooms: true } } },
    });
    if (!existing) throw new NotFoundException('Room type not found');

    if (existing._count.rooms > 0) {
      throw new BadRequestException(
        'Cannot delete room type that is used by rooms. Remove all rooms of this type first.'
      );
    }

    await this.prisma.roomType.delete({ where: { id } });
    return { success: true };
  }
}
