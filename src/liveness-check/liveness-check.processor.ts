import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { LIVENESS_CHECK_QUEUE } from './liveness-check.constants';
import { LivenessCheckService } from './liveness-check.service';

@Processor(LIVENESS_CHECK_QUEUE)
export class LivenessCheckProcessor extends WorkerHost {
  private readonly logger = new Logger(LivenessCheckProcessor.name);

  constructor(private readonly liveness: LivenessCheckService) {
    super();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async process(_job: Job): Promise<void> {
    try {
      await this.liveness.dispatchCheckBatch();
    } catch (error) {
      this.logger.error('Liveness check dispatch failed.', error);
      throw error;
    }
  }
}
