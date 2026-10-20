import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { ReportsService } from './reports.service';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

const REPORT_ROLES = [
  UserRole.OWNER,
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER,
  UserRole.HOTEL_MANAGER,
  UserRole.FRONT_DESK,
  UserRole.ACCOUNTANT,
];

@ApiTags('reports')
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('overview')
  @Roles(...REPORT_ROLES)
  async overview(
    @CurrentUser() user: AuthenticatedUser,
    @Query('hotelId') hotelId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    return this.reportsService.overview(user, { hotelId, from, to });
  }

  @Get('daily')
  @Roles(...REPORT_ROLES)
  async dailySeries(
    @CurrentUser() user: AuthenticatedUser,
    @Query('hotelId') hotelId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('days') days?: number
  ) {
    return this.reportsService.dailySeries(user, { hotelId, from, to, days: days ? Number(days) : undefined });
  }

  @Get('revenue')
  @Roles(...REPORT_ROLES)
  async revenueByCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Query('hotelId') hotelId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    return this.reportsService.revenueByCategory(user, { hotelId, from, to });
  }

  @Get('sources')
  @Roles(...REPORT_ROLES)
  async sourceBreakdown(
    @CurrentUser() user: AuthenticatedUser,
    @Query('hotelId') hotelId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    return this.reportsService.sourceBreakdown(user, { hotelId, from, to });
  }

  @Get('top-guests')
  @Roles(...REPORT_ROLES)
  async topGuests(
    @CurrentUser() user: AuthenticatedUser,
    @Query('hotelId') hotelId?: string,
    @Query('limit') limit?: number
  ) {
    return this.reportsService.topGuests(user, { hotelId, limit: limit ? Number(limit) : undefined });
  }

  @Get('housekeeping-efficiency')
  @Roles(...REPORT_ROLES)
  async housekeepingEfficiency(
    @CurrentUser() user: AuthenticatedUser,
    @Query('hotelId') hotelId?: string
  ) {
    return this.reportsService.housekeepingEfficiency(user, { hotelId });
  }
}