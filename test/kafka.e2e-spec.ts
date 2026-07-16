import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { KafkaService } from '../src/kafka/kafka.service';
import { UserEvent } from '../src/kafka/kafka.types';

describe('Kafka user events (e2e)', () => {
  let app: INestApplication<App>;
  let kafka: KafkaService;
  let stopConsumer: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.KAFKA_BROKERS = 'localhost:9092';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    kafka = app.get(KafkaService);
  });

  it('consumes same-user events in sequence order', async () => {
    const userId = randomUUID();
    const eventPrefix = `test-${randomUUID()}`;
    const received: UserEvent[] = [];
    let resolveEvents: (() => void) | undefined;
    let rejectEvents: ((reason: Error) => void) | undefined;
    const eventsReceived = new Promise<void>((resolve, reject) => {
      resolveEvents = resolve;
      rejectEvents = reject;
    });
    const timeout = setTimeout(
      () => rejectEvents?.(new Error('Kafka events were not consumed in time')),
      15_000,
    );

    stopConsumer = await kafka.consumeUserEvents(
      `kafka-e2e-${randomUUID()}`,
      (event) => {
        if (event.eventId.startsWith(eventPrefix)) {
          received.push(event);
          if (received.length === 2) {
            resolveEvents?.();
          }
        }
        return Promise.resolve();
      },
    );

    try {
      await kafka.publishUserEvent({
        eventId: `${eventPrefix}-1`,
        userId,
        sequence: 1,
        eventType: 'user.test-event',
        occurredAt: new Date().toISOString(),
        payload: { value: 'first' },
      });
      await kafka.publishUserEvent({
        eventId: `${eventPrefix}-2`,
        userId,
        sequence: 2,
        eventType: 'user.test-event',
        occurredAt: new Date().toISOString(),
        payload: { value: 'second' },
      });

      await eventsReceived;
      expect(received.map((event) => event.sequence)).toEqual([1, 2]);
    } finally {
      clearTimeout(timeout);
    }
  }, 30_000);

  afterAll(async () => {
    await stopConsumer?.();
    await app.close();
  });
});
