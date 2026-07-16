import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  ACCIDENT_MONITOR_ENABLED_ENV,
  ACCIDENT_MONITOR_INTERVAL_MS_ENV,
  ACCIDENT_MONITOR_JOB_NAME,
  ACCIDENT_MONITOR_QUEUE,
  DEFAULT_ACCIDENT_MONITOR_INTERVAL_MS,
} from './accidents.constants';

@Injectable()
export class AccidentMonitorScheduler implements OnModuleInit {
  constructor(
    @InjectQueue(ACCIDENT_MONITOR_QUEUE) private readonly queue: Queue,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    const every = Number(
      this.config.get<string>(ACCIDENT_MONITOR_INTERVAL_MS_ENV) ??
        DEFAULT_ACCIDENT_MONITOR_INTERVAL_MS,
    );

    await this.queue.add(ACCIDENT_MONITOR_JOB_NAME, undefined, {
      repeat: { every },
      removeOnComplete: true,
    });
  }

  private isEnabled(): boolean {
    const value = this.config.get<string>(ACCIDENT_MONITOR_ENABLED_ENV);
    if (!value) {
      return false;
    }
    return ['true', '1', 'yes'].includes(value.toLowerCase());
  }
}
