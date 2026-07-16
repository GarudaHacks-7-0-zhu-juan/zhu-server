import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { LIVENESS_CHECK_QUEUE } from './liveness-check.constants';
import { LivenessCheckProcessor } from './liveness-check.processor';
import { LivenessCheckScheduler } from './liveness-check.scheduler';
import { LivenessCheckService } from './liveness-check.service';

@Module({
  imports: [BullModule.registerQueue({ name: LIVENESS_CHECK_QUEUE })],
  providers: [
    LivenessCheckService,
    LivenessCheckProcessor,
    LivenessCheckScheduler,
  ],
  exports: [LivenessCheckService],
})
export class LivenessCheckModule {}
