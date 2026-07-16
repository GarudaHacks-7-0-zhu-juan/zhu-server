import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ACCIDENT_MONITOR_QUEUE } from './accidents.constants';
import { AccidentMonitorService } from './accident-monitor.service';

@Processor(ACCIDENT_MONITOR_QUEUE)
export class AccidentMonitorProcessor extends WorkerHost {
  constructor(private readonly monitor: AccidentMonitorService) {
    super();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async process(_job: Job): Promise<void> {
    await this.monitor.monitor();
  }
}
