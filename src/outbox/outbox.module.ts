import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { KafkaModule } from '../kafka/kafka.module';
import { OUTBOX_DISPATCH_QUEUE } from './outbox.constants';
import { OutboxDispatchProcessor } from './outbox-dispatch.processor';
import { OutboxDispatchService } from './outbox-dispatch.service';
import { OutboxScheduler } from './outbox-scheduler.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: OUTBOX_DISPATCH_QUEUE }),
    KafkaModule,
  ],
  providers: [OutboxDispatchService, OutboxDispatchProcessor, OutboxScheduler],
  exports: [OutboxDispatchService],
})
export class OutboxModule {}
