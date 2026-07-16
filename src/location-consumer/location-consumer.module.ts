import { Module } from '@nestjs/common';
import { KafkaModule } from '../kafka/kafka.module';
import { UserRisksModule } from '../user-risks/user-risks.module';
import { LocationConsumerService } from './location-consumer.service';

@Module({
  imports: [KafkaModule, UserRisksModule],
  providers: [LocationConsumerService],
})
export class LocationConsumerModule {}
