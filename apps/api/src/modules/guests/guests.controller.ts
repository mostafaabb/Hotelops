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
import { Gender, GuestStatus, Prisma, UserRole } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
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
import { GuestsService } from './guests.service';

class CreateGuestDto {
  @ApiProperty({ example: 'John' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Smith' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

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
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nationality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  idType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  idNumber?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isVip?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  preferences?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  specialRequests?: string;
}

class UpdateGuestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  lastName?: string;

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
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nationality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  idType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  idNumber?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isVip?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  vipLevel?: number;

  @ApiPropertyOptional({ enum: GuestStatus })
  @IsOptional()
  @IsEnum(GuestStatus)
  status?: GuestStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  preferences?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  specialRequests?: string;
}

class SetVipDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  isVip: boolean;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(0)
  vipLevel?: number;
}

const READ_ROLES: UserRole[] = [
  UserRole.OWNER,
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER,
  UserRole.HOTEL_MANAGER,
  UserRole.FRONT_DESK,
  UserRole.RESERVATION_AGENT,
  UserRole.ACCOUNTANT,
  UserRole.STAFF,
];

const WRITE_ROLES: UserRole[] = [
  UserRole.OWNER,
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER,
  UserRole.HOTEL_MANAGER,
  UserRole.FRONT_DESK,
  UserRole.RESERVATION_AGENT,
];

@ApiTags('guests')
@Controller('guests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GuestsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly guestsService: GuestsService,
    private readonly auditService: AuditService
  ) {}

  @Get()
  @Roles(...READ_ROLES)
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('isVip') isVip?: string,
    @Query('status') status?: string,
    @Query('hotelId') hotelId?: string
  ) {
    return this.guestsService.findAll(user, {
      page,
      pageSize,
      search,
      isVip,
      status,
      hotelId,
    });
  }

  @Get(':id')
  @Roles(...READ_ROLES)
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    return this.guestsService.findOne(user, id);
  }

  @Get(':id/history')
  @Roles(...READ_ROLES)
  async history(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    return this.guestsService.history(user, id);
  }

  @Post()
  @Roles(...WRITE_ROLES)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateGuestDto
  ) {
    const guest = await this.prisma.guest.create({
      data: {
        organizationId: user.organizationId,
        ...(dto as any),
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      },
    });
    await this.auditService.record(user.id, user.organizationId, 'CREATE', 'Guest', guest.id, {
      newValue: { firstName: guest.firstName, lastName: guest.lastName },
    });
    return guest;
  }

  @Patch(':id')
  @Roles(...WRITE_ROLES)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateGuestDto
  ) {
    const existing = await this.prisma.guest.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) throw new NotFoundException('Guest not found');

    const guest = await this.prisma.guest.update({
      where: { id },
      data: {
        ...(dto as any),
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      },
    });
    await this.auditService.record(user.id, user.organizationId, 'UPDATE', 'Guest', id, {
      oldValue: { firstName: existing.firstName, lastName: existing.lastName },
      newValue: { firstName: guest.firstName, lastName: guest.lastName },
    });
    return guest;
  }

  @Delete(':id')
  @Roles(...WRITE_ROLES)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    const existing = await this.prisma.guest.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) throw new NotFoundException('Guest not found');

    const guest = await this.prisma.guest.update({
      where: { id },
      data: { status: GuestStatus.INACTIVE },
    });
    await this.auditService.record(user.id, user.organizationId, 'DELETE', 'Guest', id, {
      oldValue: { status: existing.status },
    });
    return guest;
  }

  @Post(':id/vip')
  @Roles(...WRITE_ROLES)
  async setVip(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SetVipDto
  ) {
    const existing = await this.prisma.guest.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) throw new NotFoundException('Guest not found');

    const data: Prisma.GuestUpdateInput = { isVip: dto.isVip };
    if (dto.vipLevel !== undefined) data.vipLevel = dto.vipLevel;

    const guest = await this.prisma.guest.update({ where: { id }, data });
    await this.auditService.record(user.id, user.organizationId, 'CHANGE', 'Guest', id, {
      oldValue: { isVip: existing.isVip, vipLevel: existing.vipLevel },
      newValue: { isVip: guest.isVip, vipLevel: guest.vipLevel },
    });
    return guest;
  }
}