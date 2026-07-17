import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KafkaService } from '../kafka/kafka.service';
import { UserEvent } from '../kafka/kafka.types';
import { UserRisksService } from '../user-risks/user-risks.service';
import {
  DEFAULT_LOCATION_CONSUMER_GROUP,
  LOCATION_CONSUMER_ENABLED_ENV,
  LOCATION_CONSUMER_GROUP_ENV,
  LOCATION_UPDATED_EVENT_TYPE,
} from './location-consumer.constants';
import { LocationUpdatedPayload } from './location-consumer.types';

@Injectable()
export class LocationConsumerService implements OnModuleInit, OnModuleDestroy {
  private stop?: () => Promise<void>;

  constructor(
    private readonly kafka: KafkaService,
    private readonly userRisks: UserRisksService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    const groupId =
      this.config.get<string>(LOCATION_CONSUMER_GROUP_ENV) ??
      DEFAULT_LOCATION_CONSUMER_GROUP;

    this.stop = await this.kafka.consumeUserEvents(
      groupId,
      async (event: UserEvent<LocationUpdatedPayload>) => {
        if (event.eventType !== LOCATION_UPDATED_EVENT_TYPE) {
          return;
        }

        const { latitude, longitude, detectedAt, locationEventId } = event.payload;
        if (
          !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
          !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
          !locationEventId || !Number.isInteger(event.sequence) || event.sequence < 1
        ) {
          throw new Error('Location event payload is invalid.');
        }
        const detectedDate = new Date(detectedAt);
        if (Number.isNaN(detectedDate.getTime())) {
          throw new Error('Location event detectedAt is invalid.');
        }
        await this.userRisks.evaluateLocationRisk(
          event.userId,
          latitude,
          longitude,
          detectedDate,
          groupId,
          event.eventId,
          event.sequence,
          locationEventId,
        );
      },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.stop?.();
  }

  private isEnabled(): boolean {
    const value = this.config.get<string>(LOCATION_CONSUMER_ENABLED_ENV);
    if (!value) {
      return false;
    }
    return ['true', '1', 'yes'].includes(value.toLowerCase());
  }
}
