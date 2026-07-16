import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Consumer, Kafka, Partitioners, Producer } from 'kafkajs';
import {
  DEFAULT_KAFKA_BROKERS,
  DEFAULT_KAFKA_CLIENT_ID,
  DEFAULT_USER_EVENTS_PARTITIONS,
  DEFAULT_USER_EVENTS_TOPIC,
} from './kafka.constants';
import { UserEvent, UserEventHandler } from './kafka.types';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly kafka: Kafka;
  private readonly producer: Producer;
  private readonly topic: string;
  private readonly partitions: number;
  private readonly consumers = new Set<Consumer>();

  constructor(config: ConfigService) {
    this.topic =
      config.get<string>('KAFKA_USER_EVENTS_TOPIC') ??
      DEFAULT_USER_EVENTS_TOPIC;
    this.partitions = Number(
      config.get<string>('KAFKA_USER_EVENTS_PARTITIONS') ??
        DEFAULT_USER_EVENTS_PARTITIONS,
    );
    this.kafka = new Kafka({
      clientId:
        config.get<string>('KAFKA_CLIENT_ID') ?? DEFAULT_KAFKA_CLIENT_ID,
      brokers: (config.get<string>('KAFKA_BROKERS') ?? DEFAULT_KAFKA_BROKERS)
        .split(',')
        .map((broker) => broker.trim()),
    });
    this.producer = this.kafka.producer({
      allowAutoTopicCreation: false,
      createPartitioner: Partitioners.DefaultPartitioner,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.ensureTopic();
    await this.producer.connect();
  }

  async publishUserEvent(event: UserEvent): Promise<void> {
    if (!Number.isInteger(event.sequence) || event.sequence < 1) {
      throw new Error('User event sequence must be a positive integer');
    }

    await this.producer.send({
      topic: this.topic,
      acks: -1,
      messages: [
        {
          key: event.userId,
          value: JSON.stringify(event),
          headers: { eventType: event.eventType },
        },
      ],
    });
  }

  async consumeUserEvents(
    groupId: string,
    handler: UserEventHandler,
  ): Promise<() => Promise<void>> {
    const consumer = this.kafka.consumer({ groupId });
    await consumer.connect();
    await consumer.subscribe({ topic: this.topic, fromBeginning: true });
    const joined = new Promise<void>((resolve) => {
      consumer.on(consumer.events.GROUP_JOIN, () => resolve());
    });
    await consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) {
          throw new Error('Kafka user event is missing a payload');
        }

        await handler(JSON.parse(message.value.toString()) as UserEvent);
      },
    });
    this.consumers.add(consumer);
    await joined;

    return async () => {
      this.consumers.delete(consumer);
      await consumer.disconnect();
    };
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([
      ...[...this.consumers].map((consumer) => consumer.disconnect()),
      this.producer.disconnect(),
    ]);
  }

  private async ensureTopic(): Promise<void> {
    const admin = this.kafka.admin();
    await admin.connect();
    try {
      if ((await admin.listTopics()).includes(this.topic)) {
        return;
      }

      await admin.createTopics({
        waitForLeaders: true,
        topics: [
          {
            topic: this.topic,
            numPartitions: this.partitions,
            replicationFactor: 1,
          },
        ],
      });
    } finally {
      await admin.disconnect();
    }
  }
}
