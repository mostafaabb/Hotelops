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
import { ReservationStatus, UserRole } from '@prisma/client';
import { ReservationsService } from './reservations.service';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  AddActivityNoteDto,
  AssignRoomDto,
  CancelReservationDto,
  ChangeRoomDto,
  CreateReservationDto,
  ReservationListQueryDto,
  UpdateReservationDto,
  WalkInDto,
} from './dto/reservation.dto';

@ApiTags('reservations')
@Controller('reservations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Get('calendar')
  @Roles(UserRole.GENERAL_MANAGER, UserRole.HOTEL_MANAGER, UserRole.FRONT_DESK, UserRole.OWNER, UserRole.SUPER_ADMIN, UserRole.RESERVATION_AGENT)
  async calendar(
    @CurrentUser() user: AuthenticatedUser,
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('hotelId') hotelId?: string
  ) {
    return this.reservationsService.calendar(user, { month, year, hotelId });
  }

  @Get()
  @Roles(UserRole.GENERAL_MANAGER, UserRole.HOTEL_MANAGER, UserRole.FRONT_DESK, UserRole.OWNER, UserRole.SUPER_ADMIN, UserRole.RESERVATION_AGENT, UserRole.ACCOUNTANT)
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReservationListQueryDto
  ) {
    return this.reservationsService.findAll(user, query);
  }

  @Get(':idOrNumber')
  @Roles(UserRole.GENERAL_MANAGER, UserRole.HOTEL_MANAGER, UserRole.FRONT_DESK, UserRole.OWNER, UserRole.SUPER_ADMIN, UserRole.RESERVATION_AGENT, UserRole.ACCOUNTANT)
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('idOrNumber') idOrNumber: string
  ) {
    return this.reservationsService.findOne(user, idOrNumber);
  }

  @Post()
  @Roles(UserRole.GENERAL_MANAGER, UserRole.HOTEL_MANAGER, UserRole.FRONT_DESK, UserRole.OWNER, UserRole.SUPER_ADMIN, UserRole.RESERVATION_AGENT)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReservationDto
  ) {
    return this.reservationsService.create(user, dto);
  }

  @Patch(':id')
  @Roles(UserRole.GENERAL_MANAGER, UserRole.HOTEL_MANAGER, UserRole.FRONT_DESK, UserRole.OWNER, UserRole.SUPER_ADMIN, UserRole.RESERVATION_AGENT)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateReservationDto
  ) {
    return this.reservationsService.update(user, id, dto);
  }

  @Post('walk-in')
  @Roles(UserRole.FRONT_DESK, UserRole.GENERAL_MANAGER, UserRole.HOTEL_MANAGER, UserRole.OWNER, UserRole.SUPER_ADMIN)
  async walkIn(@CurrentUser() user: AuthenticatedUser, @Body() dto: WalkInDto) {
    return this.reservationsService.walkIn(user, dto);
  }

  @Post(':id/assign-room')
  @Roles(UserRole.FRONT_DESK, UserRole.GENERAL_MANAGER, UserRole.HOTEL_MANAGER, UserRole.OWNER, UserRole.SUPER_ADMIN)
  async assignRoom(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AssignRoomDto
  ) {
    return this.reservationsService.assignRoom(user, id, dto);
  }

  @Post(':id/change-room')
  @Roles(UserRole.FRONT_DESK, UserRole.GENERAL_MANAGER, UserRole.HOTEL_MANAGER, UserRole.OWNER, UserRole.SUPER_ADMIN)
  async changeRoom(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ChangeRoomDto
  ) {
    return this.reservationsService.changeRoom(user, id, dto);
  }

  @Post(':id/cancel')
  @Roles(UserRole.FRONT_DESK, UserRole.GENERAL_MANAGER, UserRole.HOTEL_MANAGER, UserRole.OWNER, UserRole.SUPER_ADMIN)
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CancelReservationDto
  ) {
    return this.reservationsService.cancel(user, id, dto);
  }

  @Post(':id/notes')
  @Roles(UserRole.FRONT_DESK, UserRole.GENERAL_MANAGER, UserRole.HOTEL_MANAGER, UserRole.OWNER, UserRole.SUPER_ADMIN)
  async addNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AddActivityNoteDto
  ) {
    return this.reservationsService.addNote(user, id, dto.note);
  }
}