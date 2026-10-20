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
import {
  HousekeepingStatus,
  HousekeepingTaskStatus,
  TaskPriority,
  UserRole,
} from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { HousekeepingService } from './housekeeping.service';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

class CreateHousekeepingTaskDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  roomId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @ApiPropertyOptional({ enum: TaskPriority })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  reservationId?: string;
}

class UpdateHousekeepingTaskDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ enum: TaskPriority })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedTo?: string;
}

class AssignTaskDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  assignedTo: string;
}

class UpdateRoomStatusDto {
  @ApiProperty({ enum: HousekeepingStatus })
  @IsEnum(HousekeepingStatus)
  @IsNotEmpty()
  housekeepingStatus: HousekeepingStatus;
}

class TaskListQueryDto {
  @ApiPropertyOptional({ enum: HousekeepingTaskStatus })
  @IsOptional()
  @IsEnum(HousekeepingTaskStatus)
  status?: HousekeepingTaskStatus;

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

@ApiTags('housekeeping')
@Controller('housekeeping')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HousekeepingController {
  constructor(private readonly housekeepingService: HousekeepingService) {}

  @Get('board')
  @Roles(
    UserRole.OWNER,
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.HOTEL_MANAGER,
    UserRole.HOUSEKEEPING_MANAGER,
    UserRole.HOUSEKEEPER
  )
  async board(
    @CurrentUser() user: AuthenticatedUser,
    @Query('hotelId') hotelId?: string
  ) {
    return this.housekeepingService.board(user, hotelId);
  }

  @Get('dashboard')
  @Roles(
    UserRole.OWNER,
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.HOTEL_MANAGER,
    UserRole.HOUSEKEEPING_MANAGER,
    UserRole.HOUSEKEEPER
  )
  async dashboard(
    @CurrentUser() user: AuthenticatedUser,
    @Query('hotelId') hotelId?: string
  ) {
    return this.housekeepingService.dashboard(user, hotelId);
  }

  @Get('tasks')
  @Roles(
    UserRole.OWNER,
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.HOTEL_MANAGER,
    UserRole.HOUSEKEEPING_MANAGER,
    UserRole.HOUSEKEEPER
  )
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: TaskListQueryDto
  ) {
    return this.housekeepingService.findAll(user, query);
  }

  @Get('tasks/:id')
  @Roles(
    UserRole.OWNER,
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.HOTEL_MANAGER,
    UserRole.HOUSEKEEPING_MANAGER,
    UserRole.HOUSEKEEPER
  )
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    return this.housekeepingService.findOne(user, id);
  }

  @Post('tasks')
  @Roles(
    UserRole.OWNER,
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.HOTEL_MANAGER,
    UserRole.HOUSEKEEPING_MANAGER
  )
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateHousekeepingTaskDto
  ) {
    return this.housekeepingService.create(user, dto);
  }

  @Patch('tasks/:id')
  @Roles(
    UserRole.OWNER,
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.HOTEL_MANAGER,
    UserRole.HOUSEKEEPING_MANAGER
  )
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateHousekeepingTaskDto
  ) {
    return this.housekeepingService.update(user, id, dto);
  }

  @Post('tasks/:id/assign')
  @Roles(
    UserRole.OWNER,
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.HOTEL_MANAGER,
    UserRole.HOUSEKEEPING_MANAGER
  )
  async assign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AssignTaskDto
  ) {
    return this.housekeepingService.assign(user, id, dto);
  }

  @Post('tasks/:id/start')
  @Roles(
    UserRole.OWNER,
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.HOTEL_MANAGER,
    UserRole.HOUSEKEEPING_MANAGER,
    UserRole.HOUSEKEEPER
  )
  async start(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    return this.housekeepingService.start(user, id);
  }

  @Post('tasks/:id/complete')
  @Roles(
    UserRole.OWNER,
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.HOTEL_MANAGER,
    UserRole.HOUSEKEEPING_MANAGER,
    UserRole.HOUSEKEEPER
  )
  async complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    return this.housekeepingService.complete(user, id);
  }

  @Post('tasks/:id/inspect')
  @Roles(
    UserRole.OWNER,
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.HOTEL_MANAGER,
    UserRole.HOUSEKEEPING_MANAGER
  )
  async inspect(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    return this.housekeepingService.inspect(user, id);
  }

  @Delete('tasks/:id')
  @Roles(
    UserRole.OWNER,
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.HOTEL_MANAGER,
    UserRole.HOUSEKEEPING_MANAGER
  )
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    return this.housekeepingService.remove(user, id);
  }

  @Post('rooms/:roomId/status')
  @Roles(
    UserRole.OWNER,
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.HOTEL_MANAGER,
    UserRole.HOUSEKEEPING_MANAGER
  )
  async updateRoomStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId') roomId: string,
    @Body() dto: UpdateRoomStatusDto
  ) {
    return this.housekeepingService.updateRoomStatus(user, roomId, dto);
  }
}