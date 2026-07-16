import { Module } from '@nestjs/common';
import { RingNotificationsService } from './ring-notifications.service';

@Module({
  providers: [RingNotificationsService],
  exports: [RingNotificationsService],
})
export class RingNotificationsModule {}
