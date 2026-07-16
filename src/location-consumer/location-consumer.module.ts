import { Module } from '@nestjs/common';
import { KafkaModule } from '../kafka/kafka.module';
import { LocationConsumerService } from './location-consumer.service';

@Module({
  imports: [KafkaModule],
  providers: [LocationConsumerService],
})
export class LocationConsumerModule {}
