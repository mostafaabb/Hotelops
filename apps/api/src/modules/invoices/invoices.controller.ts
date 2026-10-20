import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { InvoicesService } from './invoices.service';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

class VoidInvoiceDto {
  @IsString()
  reason: string;
}

@ApiTags('invoices')
@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HOTEL_MANAGER, UserRole.FRONT_DESK, UserRole.ACCOUNTANT)
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('search') search?: string,
    @Query('hotelId') hotelId?: string,
    @Query('status') status?: any,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    return this.invoicesService.findAll(user, {
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
      search,
      hotelId,
      status,
      from,
      to,
    });
  }

  @Post('from-folio/:folioId')
  @Roles(UserRole.OWNER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HOTEL_MANAGER, UserRole.FRONT_DESK, UserRole.ACCOUNTANT)
  async generateFromFolio(
    @CurrentUser() user: AuthenticatedUser,
    @Param('folioId') folioId: string
  ) {
    return this.invoicesService.generateFromFolio(user, folioId);
  }

  @Patch(':id/void')
  @Roles(UserRole.OWNER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT)
  async void(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: VoidInvoiceDto
  ) {
    return this.invoicesService.void(user, id, dto.reason);
  }

  @Get(':id')
  @Roles(UserRole.OWNER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HOTEL_MANAGER, UserRole.FRONT_DESK, UserRole.ACCOUNTANT)
  async findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.invoicesService.findOne(user, id);
  }
}