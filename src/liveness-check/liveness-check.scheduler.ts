import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  DEFAULT_LIVENESS_CHECK_INTERVAL_MS,
  LIVENESS_CHECK_INTERVAL_MS_ENV,
  LIVENESS_CHECK_JOB_NAME,
  LIVENESS_CHECK_QUEUE,
} from './liveness-check.constants';

@Injectable()
export class LivenessCheckScheduler implements OnModuleInit {
  constructor(
    @InjectQueue(LIVENESS_CHECK_QUEUE) private readonly queue: Queue,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const every = Number(
      this.config.get<string>(LIVENESS_CHECK_INTERVAL_MS_ENV) ??
        DEFAULT_LIVENESS_CHECK_INTERVAL_MS,
    );

    await this.queue.add(LIVENESS_CHECK_JOB_NAME, undefined, {
      repeat: { every },
      removeOnComplete: true,
    });
  }
}
