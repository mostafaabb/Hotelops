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
import { UserRole } from '@prisma/client';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';

class CreateAmenityDto {
  @ApiProperty({ example: 'Free WiFi' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'wifi' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isCustom?: boolean;
}

class UpdateAmenityDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isCustom?: boolean;
}

const WRITE_ROLES: UserRole[] = [
  UserRole.OWNER,
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER,
  UserRole.HOTEL_MANAGER,
];

@ApiTags('amenities')
@Controller('amenities')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AmenitiesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Roles(...WRITE_ROLES, UserRole.FRONT_DESK, UserRole.RESERVATION_AGENT, UserRole.HOUSEKEEPING_MANAGER, UserRole.MAINTENANCE_MANAGER, UserRole.STAFF)
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('search') search?: string
  ) {
    const where: Record<string, unknown> = {
      organizationId: user.organizationId,
    };
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }
    return this.prisma.amenity.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  @Post()
  @Roles(...WRITE_ROLES)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAmenityDto
  ) {
    const existing = await this.prisma.amenity.findFirst({
      where: {
        organizationId: user.organizationId,
        name: dto.name,
      },
    });
    if (existing) {
      throw new BadRequestException('An amenity with this name already exists');
    }

    return this.prisma.amenity.create({
      data: {
        organizationId: user.organizationId,
        name: dto.name,
        icon: dto.icon,
        isCustom: dto.isCustom ?? false,
      },
    });
  }

  @Patch(':id')
  @Roles(...WRITE_ROLES)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAmenityDto
  ) {
    const existing = await this.prisma.amenity.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) throw new NotFoundException('Amenity not found');

    if (dto.name && dto.name !== existing.name) {
      const duplicate = await this.prisma.amenity.findFirst({
        where: {
          organizationId: user.organizationId,
          name: dto.name,
          id: { not: id },
        },
      });
      if (duplicate) {
        throw new BadRequestException('An amenity with this name already exists');
      }
    }

    return this.prisma.amenity.update({
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
    const existing = await this.prisma.amenity.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) throw new NotFoundException('Amenity not found');

    const usageCount = await this.prisma.roomTypeAmenity.count({
      where: { amenityId: id },
    });
    if (usageCount > 0) {
      throw new BadRequestException(
        'Cannot delete amenity that is in use by room types'
      );
    }

    await this.prisma.amenity.delete({ where: { id } });
    return { success: true };
  }
}
