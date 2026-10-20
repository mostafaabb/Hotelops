import { Global, Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { RealtimeGateway } from './realtime.gateway';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, RealtimeGateway],
  exports: [NotificationsService, RealtimeGateway],
})
export class NotificationsModule {}