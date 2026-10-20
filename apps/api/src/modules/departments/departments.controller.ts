import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import {
  IsBoolean,
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

class CreateDepartmentDto {
  @ApiProperty({ example: 'Front Office' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Manages guest reception' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hotelId?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isCustom?: boolean;
}

class UpdateDepartmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hotelId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isCustom?: boolean;
}

@ApiTags('departments')
@Controller('departments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DepartmentsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN, UserRole.HOTEL_MANAGER, UserRole.FRONT_DESK, UserRole.ACCOUNTANT, UserRole.RESERVATION_AGENT, UserRole.HOUSEKEEPING_MANAGER, UserRole.MAINTENANCE_MANAGER)
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('hotelId') hotelId?: string,
  ) {
    const where: any = { organizationId: user.organizationId };
    if (hotelId) {
      where.hotelId = hotelId;
    }

    const departments = await this.prisma.department.findMany({
      where,
      include: { _count: { select: { staff: true } } },
      orderBy: { name: 'asc' },
    });

    return departments.map((d) => ({
      ...d,
      staffCount: d._count.staff,
      _count: undefined,
    }));
  }

  @Get(':id')
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN, UserRole.HOTEL_MANAGER, UserRole.FRONT_DESK, UserRole.ACCOUNTANT, UserRole.RESERVATION_AGENT, UserRole.HOUSEKEEPING_MANAGER, UserRole.MAINTENANCE_MANAGER)
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const department = await this.prisma.department.findFirst({
      where: { id, organizationId: user.organizationId },
      include: { _count: { select: { staff: true } } },
    });
    if (!department) {
      throw new BadRequestException('Department not found');
    }
    return {
      ...department,
      staffCount: department._count.staff,
      _count: undefined,
    };
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HOTEL_MANAGER)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDepartmentDto,
  ) {
    const created = await this.prisma.department.create({
      data: {
        organizationId: user.organizationId,
        name: dto.name,
        description: dto.description,
        hotelId: dto.hotelId,
        isCustom: dto.isCustom ?? false,
      },
    });
    return created;
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HOTEL_MANAGER)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    const existing = await this.prisma.department.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) {
      throw new BadRequestException('Department not found');
    }

    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.hotelId !== undefined) updateData.hotelId = dto.hotelId;
    if (dto.isCustom !== undefined) updateData.isCustom = dto.isCustom;

    const updated = await this.prisma.department.update({
      where: { id },
      data: updateData,
    });
    return updated;
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HOTEL_MANAGER)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const existing = await this.prisma.department.findFirst({
      where: { id, organizationId: user.organizationId },
      include: { _count: { select: { staff: true } } },
    });
    if (!existing) {
      throw new BadRequestException('Department not found');
    }
    if (existing._count.staff > 0) {
      throw new BadRequestException('Cannot delete department with assigned staff');
    }

    await this.prisma.department.delete({ where: { id } });
    return { deleted: true };
  }
}
