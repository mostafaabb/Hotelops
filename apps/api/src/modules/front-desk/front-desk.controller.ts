import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { FrontDeskService } from './front-desk.service';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

class CheckInOutDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  reservationId: string;
}

class NoShowDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  reservationId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

@ApiTags('front-desk')
@Controller('front-desk')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FrontDeskController {
  constructor(private readonly frontDeskService: FrontDeskService) {}

  @Get('board')
  @Roles(UserRole.FRONT_DESK, UserRole.GENERAL_MANAGER, UserRole.HOTEL_MANAGER, UserRole.RESERVATION_AGENT, UserRole.OWNER, UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT)
  async board(
    @CurrentUser() user: AuthenticatedUser,
    @Query('date') date?: string
  ) {
    return this.frontDeskService.board(user, date);
  }

  @Post('check-in')
  @Roles(UserRole.FRONT_DESK, UserRole.GENERAL_MANAGER, UserRole.HOTEL_MANAGER, UserRole.OWNER, UserRole.SUPER_ADMIN)
  async checkIn(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CheckInOutDto
  ) {
    return this.frontDeskService.checkIn(user, dto.reservationId);
  }

  @Post('check-out')
  @Roles(UserRole.FRONT_DESK, UserRole.GENERAL_MANAGER, UserRole.HOTEL_MANAGER, UserRole.OWNER, UserRole.SUPER_ADMIN)
  async checkOut(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CheckInOutDto
  ) {
    return this.frontDeskService.checkOut(user, dto.reservationId);
  }

  @Post('no-show')
  @Roles(UserRole.FRONT_DESK, UserRole.GENERAL_MANAGER, UserRole.HOTEL_MANAGER, UserRole.OWNER, UserRole.SUPER_ADMIN)
  async noShow(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: NoShowDto
  ) {
    return this.frontDeskService.noShow(user, dto.reservationId);
  }
}