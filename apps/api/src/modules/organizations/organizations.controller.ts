import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';

class UpdateOrganizationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

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
  defaultLanguage?: string;
}

@ApiTags('organizations')
@Controller('organizations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrganizationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN, UserRole.HOTEL_MANAGER, UserRole.FRONT_DESK, UserRole.ACCOUNTANT, UserRole.HOUSEKEEPING_MANAGER, UserRole.MAINTENANCE_MANAGER, UserRole.STAFF)
  async getMine(@CurrentUser() user: AuthenticatedUser) {
    const org = await this.prisma.organization.findUnique({
      where: { id: user.organizationId },
      include: {
        hotels: {
          include: { _count: { select: { rooms: true, reservations: true } } },
        },
      },
    });
    if (!org) return null;
    const { hotels, ...rest } = org as any;
    return {
      ...rest,
      hotels: hotels.map((h: any) => ({
        ...h,
        totalRooms: h._count.rooms,
        totalReservations: h._count.reservations,
        _count: undefined,
      })),
    };
  }

  @Patch('me')
  @Roles(UserRole.OWNER, UserRole.SUPER_ADMIN)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateOrganizationDto
  ) {
    return this.prisma.organization.update({
      where: { id: user.organizationId },
      data: dto as any,
    });
  }

  @Get('summary')
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN)
  async summary(@CurrentUser() user: AuthenticatedUser) {
    const [hotels, users, guests, rooms] = await Promise.all([
      this.prisma.hotel.count({ where: { organizationId: user.organizationId } }),
      this.prisma.user.count({ where: { organizationId: user.organizationId } }),
      this.prisma.guest.count({ where: { organizationId: user.organizationId } }),
      this.prisma.room.count({ where: { organizationId: user.organizationId } }),
    ]);
    return { hotels, users, guests, rooms };
  }
}