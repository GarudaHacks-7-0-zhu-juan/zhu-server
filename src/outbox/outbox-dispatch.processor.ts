import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { OutboxDispatchService } from './outbox-dispatch.service';
import { OUTBOX_DISPATCH_QUEUE } from './outbox.constants';

@Processor(OUTBOX_DISPATCH_QUEUE)
export class OutboxDispatchProcessor extends WorkerHost {
  constructor(private readonly dispatch: OutboxDispatchService) {
    super();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async process(_job: Job): Promise<void> {
    await this.dispatch.dispatchBatch();
  }
}
