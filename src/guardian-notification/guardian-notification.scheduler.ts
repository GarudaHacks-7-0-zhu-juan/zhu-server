import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import {
  DEFAULT_GUARDIAN_NOTIFICATION_INTERVAL_MS,
  GUARDIAN_NOTIFICATION_DISPATCH_JOB_NAME,
  GUARDIAN_NOTIFICATION_ENABLED_ENV,
  GUARDIAN_NOTIFICATION_INTERVAL_MS_ENV,
  GUARDIAN_NOTIFICATION_QUEUE,
} from './guardian-notification.constants';

@Injectable()
export class GuardianNotificationScheduler implements OnModuleInit {
  constructor(
    @InjectQueue(GUARDIAN_NOTIFICATION_QUEUE) private readonly queue: Queue,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const enabled = this.config
      .get<string>(GUARDIAN_NOTIFICATION_ENABLED_ENV)
      ?.toLowerCase();
    if (!enabled || !['true', '1', 'yes'].includes(enabled)) {
      return;
    }

    const every = Number(
      this.config.get<string>(GUARDIAN_NOTIFICATION_INTERVAL_MS_ENV) ??
        DEFAULT_GUARDIAN_NOTIFICATION_INTERVAL_MS,
    );
    await this.queue.add(GUARDIAN_NOTIFICATION_DISPATCH_JOB_NAME, undefined, {
      repeat: { every },
      removeOnComplete: true,
    });
  }
}
