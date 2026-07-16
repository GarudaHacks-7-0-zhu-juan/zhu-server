import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  DEFAULT_EARTHQUAKE_POLLING_INTERVAL_MS,
  EARTHQUAKE_POLLING_ENABLED_ENV,
  EARTHQUAKE_POLLING_INTERVAL_MS_ENV,
  EARTHQUAKE_POLLING_JOB_NAME,
  EARTHQUAKE_POLLING_QUEUE,
} from './earthquake.constants';

@Injectable()
export class EarthquakeScheduler implements OnModuleInit {
  constructor(
    @InjectQueue(EARTHQUAKE_POLLING_QUEUE) private readonly queue: Queue,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    const every = Number(
      this.config.get<string>(EARTHQUAKE_POLLING_INTERVAL_MS_ENV) ??
        DEFAULT_EARTHQUAKE_POLLING_INTERVAL_MS,
    );

    await this.queue.add(EARTHQUAKE_POLLING_JOB_NAME, undefined, {
      repeat: { every },
      removeOnComplete: true,
    });
  }

  private isEnabled(): boolean {
    const value = this.config.get<string>(EARTHQUAKE_POLLING_ENABLED_ENV);
    if (!value) {
      return false;
    }
    return ['true', '1', 'yes'].includes(value.toLowerCase());
  }
}
