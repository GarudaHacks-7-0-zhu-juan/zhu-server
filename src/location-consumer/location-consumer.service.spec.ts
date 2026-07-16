import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { KafkaService } from '../kafka/kafka.service';
import { UserEvent, UserEventHandler } from '../kafka/kafka.types';
import {
  DEFAULT_LOCATION_CONSUMER_GROUP,
  LOCATION_CONSUMER_ENABLED_ENV,
  LOCATION_CONSUMER_GROUP_ENV,
} from './location-consumer.constants';
import { LocationConsumerService } from './location-consumer.service';

describe('LocationConsumerService', () => {
  let service: LocationConsumerService;
  let kafka: KafkaService;

  const mockKafka = {
    consumeUserEvents: jest.fn(),
  };

  const mockConfig = {
    get: jest.fn(),
  };

  const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationConsumerService,
        { provide: KafkaService, useValue: mockKafka },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<LocationConsumerService>(LocationConsumerService);
    kafka = module.get<KafkaService>(KafkaService);

    jest.clearAllMocks();
    consoleSpy.mockClear();
  });

  afterAll(() => {
    consoleSpy.mockRestore();
  });

  describe('onModuleInit', () => {
    it('does not subscribe when disabled', async () => {
      mockConfig.get.mockReturnValue(undefined);
      const consumeSpy = jest.spyOn(kafka, 'consumeUserEvents');

      await service.onModuleInit();

      expect(consumeSpy).not.toHaveBeenCalled();
    });

    it('subscribes with the default group when enabled', async () => {
      const stop = jest.fn();
      mockKafka.consumeUserEvents.mockResolvedValue(stop);
      mockConfig.get.mockImplementation((key: string) => {
        if (key === LOCATION_CONSUMER_ENABLED_ENV) return 'true';
        return undefined;
      });
      const consumeSpy = jest.spyOn(kafka, 'consumeUserEvents');

      await service.onModuleInit();

      expect(consumeSpy).toHaveBeenCalledWith(
        DEFAULT_LOCATION_CONSUMER_GROUP,
        expect.any(Function),
      );
    });

    it('uses a custom group id from env', async () => {
      const stop = jest.fn();
      mockKafka.consumeUserEvents.mockResolvedValue(stop);
      mockConfig.get.mockImplementation((key: string) => {
        if (key === LOCATION_CONSUMER_ENABLED_ENV) return 'true';
        if (key === LOCATION_CONSUMER_GROUP_ENV) return 'custom-group';
        return undefined;
      });
      const consumeSpy = jest.spyOn(kafka, 'consumeUserEvents');

      await service.onModuleInit();

      expect(consumeSpy).toHaveBeenCalledWith(
        'custom-group',
        expect.any(Function),
      );
    });
  });

  describe('handler', () => {
    const getHandler = async (): Promise<UserEventHandler> => {
      const stop = jest.fn();
      mockKafka.consumeUserEvents.mockResolvedValue(stop);
      mockConfig.get.mockImplementation((key: string) => {
        if (key === LOCATION_CONSUMER_ENABLED_ENV) return 'true';
        return undefined;
      });
      await service.onModuleInit();
      const consumeSpy = jest.spyOn(kafka, 'consumeUserEvents');
      return consumeSpy.mock.calls[0][1];
    };

    it('logs location updated events', async () => {
      const handler = await getHandler();

      const event: UserEvent = {
        eventId: 'e-1',
        userId: 'user-1',
        sequence: 1,
        eventType: 'user.location.updated',
        occurredAt: new Date().toISOString(),
        payload: {
          latitude: 1,
          longitude: 2,
          detectedAt: new Date().toISOString(),
          locationEventId: 'le-1',
        },
      };

      await handler(event);

      expect(consoleSpy).toHaveBeenCalledWith('[location-worker]', event);
    });

    it('ignores non-location events', async () => {
      const handler = await getHandler();

      const event: UserEvent = {
        eventId: 'e-2',
        userId: 'user-1',
        sequence: 2,
        eventType: 'user.risk.updated',
        occurredAt: new Date().toISOString(),
        payload: {},
      };

      await handler(event);

      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy', () => {
    it('calls the stop function when subscribed', async () => {
      const stop = jest.fn();
      mockKafka.consumeUserEvents.mockResolvedValue(stop);
      mockConfig.get.mockImplementation((key: string) => {
        if (key === LOCATION_CONSUMER_ENABLED_ENV) return 'true';
        return undefined;
      });
      const consumeSpy = jest.spyOn(kafka, 'consumeUserEvents');

      await service.onModuleInit();
      await service.onModuleDestroy();

      expect(stop).toHaveBeenCalled();
      expect(consumeSpy).toHaveBeenCalled();
    });

    it('does nothing when not subscribed', async () => {
      mockConfig.get.mockReturnValue(undefined);
      const consumeSpy = jest.spyOn(kafka, 'consumeUserEvents');

      await service.onModuleInit();
      await service.onModuleDestroy();

      expect(consumeSpy).not.toHaveBeenCalled();
    });
  });
});
