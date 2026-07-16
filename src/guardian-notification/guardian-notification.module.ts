import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { PushModule } from '../push/push.module';
import { GUARDIAN_NOTIFICATION_QUEUE } from './guardian-notification.constants';
import { GuardianNotificationProcessor } from './guardian-notification.processor';
import { GuardianNotificationScheduler } from './guardian-notification.scheduler';
import { GuardianNotificationService } from './guardian-notification.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: GUARDIAN_NOTIFICATION_QUEUE }),
    PushModule,
  ],
  providers: [
    GuardianNotificationService,
    GuardianNotificationProcessor,
    GuardianNotificationScheduler,
  ],
  exports: [GuardianNotificationService],
})
export class GuardianNotificationModule {}
