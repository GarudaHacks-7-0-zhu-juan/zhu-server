import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { EARTHQUAKE_POLLING_QUEUE } from './earthquake.constants';
import { EarthquakePollerService } from './earthquake.poller';

@Processor(EARTHQUAKE_POLLING_QUEUE)
export class EarthquakeProcessor extends WorkerHost {
  constructor(private readonly poller: EarthquakePollerService) {
    super();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async process(_job: Job): Promise<void> {
    await this.poller.poll();
  }
}
