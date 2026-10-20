import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FolioEntryType, UserRole } from '@prisma/client';
import { IsEnum, IsIn, IsNumber, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';
import { FoliosService } from './folios.service';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

class AddFolioEntryDto {
  @IsEnum(FolioEntryType)
  type: FolioEntryType;

  @IsString()
  description: string;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsOptional()
  @IsNumber()
  taxAmount?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  quantity?: number;
}

@ApiTags('folios')
@Controller('folios')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FoliosController {
  constructor(private readonly foliosService: FoliosService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HOTEL_MANAGER, UserRole.FRONT_DESK, UserRole.ACCOUNTANT)
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('search') search?: string,
    @Query('hotelId') hotelId?: string,
    @Query('hasBalance') hasBalance?: string
  ) {
    return this.foliosService.findAll(user, {
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
      search,
      hotelId,
      hasBalance,
    });
  }

  @Get('reservation/:reservationId')
  @Roles(UserRole.OWNER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HOTEL_MANAGER, UserRole.FRONT_DESK, UserRole.ACCOUNTANT)
  async findByReservation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reservationId') reservationId: string
  ) {
    return this.foliosService.findByReservation(user, reservationId);
  }

  @Post(':folioId/entries')
  @Roles(UserRole.OWNER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HOTEL_MANAGER, UserRole.FRONT_DESK, UserRole.ACCOUNTANT)
  async addEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Param('folioId') folioId: string,
    @Body() dto: AddFolioEntryDto
  ) {
    return this.foliosService.addEntry(user, folioId, dto);
  }

  @Get(':id')
  @Roles(UserRole.OWNER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HOTEL_MANAGER, UserRole.FRONT_DESK, UserRole.ACCOUNTANT)
  async findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.foliosService.findOne(user, id);
  }
}