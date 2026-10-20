import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { PaymentMethod, PaymentStatus, UserRole } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';
import { PaymentsService } from './payments.service';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

class CreatePaymentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  reservationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  guestId?: string;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({ enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

class RefundPaymentDto {
  @ApiProperty()
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

@ApiTags('payments')
@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HOTEL_MANAGER, UserRole.FRONT_DESK, UserRole.ACCOUNTANT)
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('search') search?: string,
    @Query('hotelId') hotelId?: string,
    @Query('status') status?: PaymentStatus,
    @Query('method') method?: PaymentMethod,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    return this.paymentsService.findAll(user, {
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
      search,
      hotelId,
      status,
      method,
      from,
      to,
    });
  }

  @Get('summary')
  @Roles(UserRole.OWNER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HOTEL_MANAGER, UserRole.ACCOUNTANT)
  async summary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('hotelId') hotelId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    return this.paymentsService.summary(user, hotelId, from, to);
  }

  @Get(':id')
  @Roles(UserRole.OWNER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HOTEL_MANAGER, UserRole.FRONT_DESK, UserRole.ACCOUNTANT)
  async findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.paymentsService.findOne(user, id);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HOTEL_MANAGER, UserRole.FRONT_DESK, UserRole.ACCOUNTANT)
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(user, dto);
  }

  @Post(':id/refund')
  @Roles(UserRole.OWNER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT)
  async refund(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RefundPaymentDto
  ) {
    return this.paymentsService.refund(user, id, dto.amount, dto.reason);
  }
}