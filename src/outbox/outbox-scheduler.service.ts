import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  DEFAULT_OUTBOX_DISPATCH_INTERVAL_MS,
  OUTBOX_DISPATCH_JOB_NAME,
  OUTBOX_DISPATCH_QUEUE,
} from './outbox.constants';

@Injectable()
export class OutboxScheduler implements OnModuleInit {
  constructor(
    @InjectQueue(OUTBOX_DISPATCH_QUEUE) private readonly queue: Queue,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const every = Number(
      this.config.get<string>('OUTBOX_DISPATCH_INTERVAL_MS') ??
        DEFAULT_OUTBOX_DISPATCH_INTERVAL_MS,
    );

    await this.queue.add(OUTBOX_DISPATCH_JOB_NAME, undefined, {
      repeat: { every },
      removeOnComplete: true,
    });
  }
}
