import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { LIVENESS_CHECK_QUEUE } from './liveness-check.constants';
import { LivenessCheckService } from './liveness-check.service';

@Processor(LIVENESS_CHECK_QUEUE)
export class LivenessCheckProcessor extends WorkerHost {
  constructor(private readonly liveness: LivenessCheckService) {
    super();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async process(_job: Job): Promise<void> {
    await this.liveness.dispatchCheckBatch();
  }
}
