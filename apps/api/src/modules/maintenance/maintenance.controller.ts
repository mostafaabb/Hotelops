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
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  MaintenanceCategory,
  MaintenanceRequestStatus,
  TaskPriority,
  UserRole,
} from '@prisma/client';
import {
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
import { MaintenanceService } from './maintenance.service';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

class CreateMaintenanceRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  roomId?: string;

  @ApiProperty({ enum: MaintenanceCategory })
  @IsEnum(MaintenanceCategory)
  @IsNotEmpty()
  category: MaintenanceCategory;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: TaskPriority })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  cost?: number;
}

class UpdateMaintenanceRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: MaintenanceCategory })
  @IsOptional()
  @IsEnum(MaintenanceCategory)
  category?: MaintenanceCategory;

  @ApiPropertyOptional({ enum: TaskPriority })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  roomId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  cost?: number;
}

class AssignMaintenanceDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  assignedTo: string;
}

class ResolveMaintenanceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  cost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

class MaintenanceListQueryDto {
  @ApiPropertyOptional({ enum: MaintenanceRequestStatus })
  @IsOptional()
  @IsEnum(MaintenanceRequestStatus)
  status?: MaintenanceRequestStatus;

  @ApiPropertyOptional({ enum: TaskPriority })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional({ enum: MaintenanceCategory })
  @IsOptional()
  @IsEnum(MaintenanceCategory)
  category?: MaintenanceCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  roomId?: string;

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

@ApiTags('maintenance')
@Controller('maintenance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Get('dashboard')
  @Roles(
    UserRole.OWNER,
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.HOTEL_MANAGER,
    UserRole.MAINTENANCE_MANAGER,
    UserRole.MAINTENANCE_STAFF
  )
  async dashboard(
    @CurrentUser() user: AuthenticatedUser,
    @Query('hotelId') hotelId?: string
  ) {
    return this.maintenanceService.dashboard(user, hotelId);
  }

  @Get('requests')
  @Roles(
    UserRole.OWNER,
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.HOTEL_MANAGER,
    UserRole.MAINTENANCE_MANAGER,
    UserRole.MAINTENANCE_STAFF
  )
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: MaintenanceListQueryDto
  ) {
    return this.maintenanceService.findAll(user, query);
  }

  @Get('requests/:id')
  @Roles(
    UserRole.OWNER,
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.HOTEL_MANAGER,
    UserRole.MAINTENANCE_MANAGER,
    UserRole.MAINTENANCE_STAFF
  )
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    return this.maintenanceService.findOne(user, id);
  }

  @Post('requests')
  @Roles(
    UserRole.OWNER,
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.HOTEL_MANAGER,
    UserRole.MAINTENANCE_MANAGER
  )
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMaintenanceRequestDto
  ) {
    return this.maintenanceService.create(user, dto);
  }

  @Patch('requests/:id')
  @Roles(
    UserRole.OWNER,
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.HOTEL_MANAGER,
    UserRole.MAINTENANCE_MANAGER
  )
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateMaintenanceRequestDto
  ) {
    return this.maintenanceService.update(user, id, dto);
  }

  @Post('requests/:id/assign')
  @Roles(
    UserRole.OWNER,
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.HOTEL_MANAGER,
    UserRole.MAINTENANCE_MANAGER
  )
  async assign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AssignMaintenanceDto
  ) {
    return this.maintenanceService.assign(user, id, dto);
  }

  @Post('requests/:id/start')
  @Roles(
    UserRole.OWNER,
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.HOTEL_MANAGER,
    UserRole.MAINTENANCE_MANAGER,
    UserRole.MAINTENANCE_STAFF
  )
  async start(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    return this.maintenanceService.start(user, id);
  }

  @Post('requests/:id/resolve')
  @Roles(
    UserRole.OWNER,
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.HOTEL_MANAGER,
    UserRole.MAINTENANCE_MANAGER,
    UserRole.MAINTENANCE_STAFF
  )
  async resolve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ResolveMaintenanceDto
  ) {
    return this.maintenanceService.resolve(user, id, dto);
  }

  @Post('requests/:id/close')
  @Roles(
    UserRole.OWNER,
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.HOTEL_MANAGER,
    UserRole.MAINTENANCE_MANAGER
  )
  async close(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    return this.maintenanceService.close(user, id);
  }
}