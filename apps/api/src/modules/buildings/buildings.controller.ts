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
import { UserRole } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsInt,
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

class CreateBuildingDto {
  @ApiProperty({ example: 'Main Building' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'MB' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  hotelId: string;
}

class UpdateBuildingDto {
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
}

class CreateFloorDto {
  @ApiProperty({ example: 'Ground Floor' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 0 })
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  number: number;
}

class UpdateFloorDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  number?: number;
}

const WRITE_ROLES: UserRole[] = [
  UserRole.OWNER,
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER,
  UserRole.HOTEL_MANAGER,
];

@ApiTags('buildings')
@Controller('buildings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BuildingsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Roles(...WRITE_ROLES, UserRole.FRONT_DESK, UserRole.RESERVATION_AGENT, UserRole.HOUSEKEEPING_MANAGER, UserRole.MAINTENANCE_MANAGER, UserRole.STAFF)
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('hotelId') hotelId?: string
  ) {
    const where: Record<string, unknown> = {
      hotel: { organizationId: user.organizationId },
    };
    if (hotelId) where.hotelId = hotelId;

    const buildings = await this.prisma.building.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        floors: {
          orderBy: { number: 'asc' },
          include: { _count: { select: { rooms: true } } },
        },
        _count: { select: { rooms: true } },
      },
    });

    return buildings.map((b) => ({
      ...b,
      totalRooms: b._count.rooms,
      floors: b.floors.map((f) => ({
        ...f,
        roomCount: f._count.rooms,
        _count: undefined,
      })),
      _count: undefined,
    }));
  }

  @Get(':id')
  @Roles(...WRITE_ROLES, UserRole.FRONT_DESK, UserRole.RESERVATION_AGENT, UserRole.HOUSEKEEPING_MANAGER, UserRole.MAINTENANCE_MANAGER, UserRole.STAFF)
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    const building = await this.prisma.building.findFirst({
      where: {
        id,
        hotel: { organizationId: user.organizationId },
      },
      include: {
        floors: {
          orderBy: { number: 'asc' },
          include: { _count: { select: { rooms: true } } },
        },
        _count: { select: { rooms: true } },
      },
    });
    if (!building) throw new NotFoundException('Building not found');
    return {
      ...building,
      totalRooms: building._count.rooms,
      floors: building.floors.map((f) => ({
        ...f,
        roomCount: f._count.rooms,
        _count: undefined,
      })),
      _count: undefined,
    };
  }

  @Post()
  @Roles(...WRITE_ROLES)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBuildingDto
  ) {
    const hotel = await this.prisma.hotel.findFirst({
      where: { id: dto.hotelId, organizationId: user.organizationId },
    });
    if (!hotel) throw new NotFoundException('Hotel not found');

    return this.prisma.building.create({
      data: {
        hotelId: dto.hotelId,
        name: dto.name,
        code: dto.code,
        description: dto.description,
      },
    });
  }

  @Patch(':id')
  @Roles(...WRITE_ROLES)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateBuildingDto
  ) {
    const existing = await this.prisma.building.findFirst({
      where: { id, hotel: { organizationId: user.organizationId } },
    });
    if (!existing) throw new NotFoundException('Building not found');

    return this.prisma.building.update({
      where: { id },
      data: dto as never,
    });
  }

  @Delete(':id')
  @Roles(...WRITE_ROLES)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    const existing = await this.prisma.building.findFirst({
      where: { id, hotel: { organizationId: user.organizationId } },
    });
    if (!existing) throw new NotFoundException('Building not found');

    await this.prisma.building.delete({ where: { id } });
    return { success: true };
  }

  @Get(':id/floors')
  @Roles(...WRITE_ROLES, UserRole.FRONT_DESK, UserRole.RESERVATION_AGENT, UserRole.HOUSEKEEPING_MANAGER, UserRole.MAINTENANCE_MANAGER, UserRole.STAFF)
  async findFloors(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    const building = await this.prisma.building.findFirst({
      where: { id, hotel: { organizationId: user.organizationId } },
    });
    if (!building) throw new NotFoundException('Building not found');

    return this.prisma.floor.findMany({
      where: { buildingId: id },
      orderBy: { number: 'asc' },
      include: { _count: { select: { rooms: true } } },
    });
  }

  @Post(':id/floors')
  @Roles(...WRITE_ROLES)
  async createFloor(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateFloorDto
  ) {
    const building = await this.prisma.building.findFirst({
      where: { id, hotel: { organizationId: user.organizationId } },
    });
    if (!building) throw new NotFoundException('Building not found');

    return this.prisma.floor.create({
      data: {
        buildingId: id,
        name: dto.name,
        number: dto.number,
      },
    });
  }

  @Patch('floors/:floorId')
  @Roles(...WRITE_ROLES)
  async updateFloor(
    @CurrentUser() user: AuthenticatedUser,
    @Param('floorId') floorId: string,
    @Body() dto: UpdateFloorDto
  ) {
    const floor = await this.prisma.floor.findFirst({
      where: {
        id: floorId,
        building: { hotel: { organizationId: user.organizationId } },
      },
    });
    if (!floor) throw new NotFoundException('Floor not found');

    return this.prisma.floor.update({
      where: { id: floorId },
      data: dto as never,
    });
  }

  @Delete('floors/:floorId')
  @Roles(...WRITE_ROLES)
  async removeFloor(
    @CurrentUser() user: AuthenticatedUser,
    @Param('floorId') floorId: string
  ) {
    const floor = await this.prisma.floor.findFirst({
      where: {
        id: floorId,
        building: { hotel: { organizationId: user.organizationId } },
      },
    });
    if (!floor) throw new NotFoundException('Floor not found');

    await this.prisma.floor.delete({ where: { id: floorId } });
    return { success: true };
  }
}
