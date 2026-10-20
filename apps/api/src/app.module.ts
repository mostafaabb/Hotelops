import { APP_GUARD } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { MailModule } from './mail/mail.module';
import { AuditModule } from './modules/audit/audit.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PricingModule } from './pricing/pricing.module';
import { AvailabilityModule } from './availability/availability.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { FrontDeskModule } from './modules/front-desk/front-desk.module';
import { UsersModule } from './modules/users/users.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { StaffModule } from './modules/staff/staff.module';
import { RoomTypesModule } from './modules/room-types/room-types.module';
import { AmenitiesModule } from './modules/amenities/amenities.module';
import { BuildingsModule } from './modules/buildings/buildings.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { GuestsModule } from './modules/guests/guests.module';
import { RatePlansModule } from './modules/rate-plans/rate-plans.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { VendorsModule } from './modules/vendors/vendors.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { HousekeepingModule } from './modules/housekeeping/housekeeping.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { ServicesModule } from './modules/services/services.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { HotelsModule } from './modules/hotels/hotels.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { FoliosModule } from './modules/folios/folios.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { ReportsModule } from './modules/reports/reports.module';
import { HealthModule } from './modules/health/health.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { RateLimitGuard } from './common/guards/rate-limit.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
    MailModule,
    AuditModule,
    NotificationsModule,
    PricingModule,
    AvailabilityModule,
    ReservationsModule,
    FrontDeskModule,
    AuthModule,
    UsersModule,
    DepartmentsModule,
    StaffModule,
    RoomTypesModule,
    AmenitiesModule,
    BuildingsModule,
    RoomsModule,
    GuestsModule,
    RatePlansModule,
    ExpensesModule,
    VendorsModule,
    InventoryModule,
    HousekeepingModule,
    MaintenanceModule,
    ServicesModule,
    OrganizationsModule,
    HotelsModule,
    PaymentsModule,
    FoliosModule,
    InvoicesModule,
    ReportsModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}