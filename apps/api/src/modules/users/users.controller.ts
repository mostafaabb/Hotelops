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
import { UserStatus, UserRole } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';

class CreateUserDto {
  @ApiProperty({ example: 'John' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  lastName: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: '+1234567890' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ enum: UserRole, default: UserRole.STAFF })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hotelId?: string;

  @ApiPropertyOptional({ example: 'password123' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ enum: UserStatus, default: UserStatus.ACTIVE })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}

class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hotelId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  password?: string;
}

class UpdateStatusDto {
  @ApiProperty({ enum: UserStatus })
  @IsEnum(UserStatus)
  status: UserStatus;
}

const USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  hotelId: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
  avatar: true,
} as const;

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN, UserRole.HOTEL_MANAGER, UserRole.FRONT_DESK, UserRole.ACCOUNTANT, UserRole.RESERVATION_AGENT, UserRole.HOUSEKEEPING_MANAGER, UserRole.MAINTENANCE_MANAGER)
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('role') role?: UserRole,
    @Query('status') status?: UserStatus,
    @Query('hotelId') hotelId?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const size = Math.min(100, Math.max(1, parseInt(pageSize ?? '20', 10) || 20));
    const skip = (pageNum - 1) * size;

    const where: any = { organizationId: user.organizationId };

    if (hotelId) {
      where.hotelId = hotelId;
    }
    if (role) {
      where.role = role;
    }
    if (status) {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: USER_SELECT,
        orderBy: { createdAt: 'desc' },
        skip,
        take: size,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data, total, page: pageNum, pageSize: size };
  }

  @Get(':id')
  @Roles(UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN, UserRole.HOTEL_MANAGER, UserRole.FRONT_DESK, UserRole.ACCOUNTANT, UserRole.RESERVATION_AGENT, UserRole.HOUSEKEEPING_MANAGER, UserRole.MAINTENANCE_MANAGER)
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const found = await this.prisma.user.findFirst({
      where: { id, organizationId: user.organizationId },
      select: USER_SELECT,
    });
    if (!found) {
      throw new BadRequestException('User not found');
    }
    return found;
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateUserDto,
  ) {
    const data: any = {
      organizationId: user.organizationId,
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      phone: dto.phone,
      role: dto.role,
      hotelId: dto.hotelId,
      status: dto.status ?? UserStatus.ACTIVE,
    };

    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 12);
    }

    const created = await this.prisma.user.create({
      data,
      select: USER_SELECT,
    });
    return created;
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    const existing = await this.prisma.user.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) {
      throw new BadRequestException('User not found');
    }

    const updateData: any = {};
    if (dto.firstName !== undefined) updateData.firstName = dto.firstName;
    if (dto.lastName !== undefined) updateData.lastName = dto.lastName;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.role !== undefined) updateData.role = dto.role;
    if (dto.hotelId !== undefined) updateData.hotelId = dto.hotelId;
    if (dto.password) {
      updateData.passwordHash = await bcrypt.hash(dto.password, 12);
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: updateData,
      select: USER_SELECT,
    });
    return updated;
  }

  @Patch(':id/status')
  @Roles(UserRole.OWNER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER)
  async updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    const existing = await this.prisma.user.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) {
      throw new BadRequestException('User not found');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { status: dto.status },
      select: USER_SELECT,
    });
    return updated;
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const existing = await this.prisma.user.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) {
      throw new BadRequestException('User not found');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.INACTIVE },
      select: USER_SELECT,
    });
    return updated;
  }
}
