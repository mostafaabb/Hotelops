import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { ServiceOrderStatus, UserRole } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ServicesService } from './services.service';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

class CreateServiceDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 25 })
  @IsNumber()
  price: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsNumber()
  taxRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  image?: string;
}

class UpdateServiceDto {
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
  @IsNumber()
  price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  taxRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  image?: string;
}

class CreateServiceOrderDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  reservationId: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  serviceId: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  requestedTime?: string;
}

class ServiceListQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  hotelId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

class ServiceOrderListQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  reservationId?: string;

  @ApiPropertyOptional({ enum: ServiceOrderStatus })
  @IsOptional()
  @IsEnum(ServiceOrderStatus)
  status?: ServiceOrderStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  hotelId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

@ApiTags('services')
@Controller('services')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get('services')
  @Roles(
    UserRole.OWNER,
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.HOTEL_MANAGER,
    UserRole.FRONT_DESK
  )
  async findServices(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ServiceListQueryDto
  ) {
    return this.servicesService.findServices(user, query);
  }

  @Get('services/catalog')
  @Roles(
    UserRole.OWNER,
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.HOTEL_MANAGER,
    UserRole.FRONT_DESK
  )
  async findCatalog(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ServiceListQueryDto
  ) {
    return this.servicesService.findServices(user, query);
  }

  @Post('services')
  @Roles(
    UserRole.OWNER,
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.HOTEL_MANAGER
  )
  async createService(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateServiceDto
  ) {
    return this.servicesService.createService(user, dto);
  }

  @Patch('services/:id')
  @Roles(
    UserRole.OWNER,
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.HOTEL_MANAGER
  )
  async updateService(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto
  ) {
    return this.servicesService.updateService(user, id, dto);
  }

  @Delete('services/:id')
  @Roles(
    UserRole.OWNER,
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.HOTEL_MANAGER
  )
  async deleteService(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    return this.servicesService.deleteService(user, id);
  }

  @Get('service-orders')
  @Roles(
    UserRole.OWNER,
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.HOTEL_MANAGER,
    UserRole.FRONT_DESK,
    UserRole.ACCOUNTANT
  )
  async findOrders(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ServiceOrderListQueryDto
  ) {
    return this.servicesService.findOrders(user, query);
  }

  @Get('service-orders/:id')
  @Roles(
    UserRole.OWNER,
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.HOTEL_MANAGER,
    UserRole.FRONT_DESK,
    UserRole.ACCOUNTANT
  )
  async findOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    return this.servicesService.findOrder(user, id);
  }

  @Post('service-orders')
  @Roles(
    UserRole.OWNER,
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.HOTEL_MANAGER,
    UserRole.FRONT_DESK
  )
  async createOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateServiceOrderDto
  ) {
    return this.servicesService.createOrder(user, dto);
  }

  @Post('service-orders/:id/cancel')
  @Roles(
    UserRole.OWNER,
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.HOTEL_MANAGER,
    UserRole.FRONT_DESK
  )
  async cancelOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    return this.servicesService.cancelOrder(user, id);
  }
}