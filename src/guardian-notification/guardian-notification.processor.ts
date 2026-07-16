import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  GUARDIAN_NOTIFICATION_NEGATIVE_RESPONSE_JOB_NAME,
  GUARDIAN_NOTIFICATION_QUEUE,
} from './guardian-notification.constants';
import { GuardianNotificationService } from './guardian-notification.service';
import { NegativeResponseJob } from './guardian-notification.types';

@Processor(GUARDIAN_NOTIFICATION_QUEUE)
export class GuardianNotificationProcessor extends WorkerHost {
  constructor(private readonly notifications: GuardianNotificationService) {
    super();
  }

  async process(job: Job<NegativeResponseJob>): Promise<void> {
    console.log(
      `[guardian-notification] ${new Date().toISOString()} - running ${job.name} job`,
    );

    if (job.name === GUARDIAN_NOTIFICATION_NEGATIVE_RESPONSE_JOB_NAME) {
      console.log(
        `[guardian-notification] ${new Date().toISOString()} - processing negative response`,
        job.data,
      );
      await this.notifications.dispatchNegativeResponse(job.data);
      return;
    }

    await this.notifications.dispatchTimeoutAlerts();
  }
}
