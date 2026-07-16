import type Redis from 'ioredis';
import { RedisPubSubService } from './redis-pub-sub.service';

describe('RedisPubSubService', () => {
  let messageHandler: ((channel: string, message: string) => void) | undefined;
  const publisher = {
    publish: jest.fn(),
    quit: jest.fn(),
  };
  const subscriber = {
    on: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    quit: jest.fn(),
  };
  let service: RedisPubSubService;

  beforeEach(() => {
    jest.resetAllMocks();
    publisher.publish = jest.fn().mockResolvedValue(1);
    publisher.quit = jest.fn().mockResolvedValue('OK');
    subscriber.subscribe = jest.fn().mockResolvedValue(1);
    subscriber.unsubscribe = jest.fn().mockResolvedValue(0);
    subscriber.quit = jest.fn().mockResolvedValue('OK');
    subscriber.on = jest.fn((event: string, handler: unknown) => {
      if (event === 'message') {
        messageHandler = handler as (channel: string, message: string) => void;
      }
      return subscriber;
    });
    service = new RedisPubSubService(
      publisher as unknown as Redis,
      subscriber as unknown as Redis,
    );
  });

  it('serializes and publishes an event', async () => {
    await expect(
      service.publish('verification.events', { eventId: 'event-1' }),
    ).resolves.toBe(1);

    expect(publisher.publish).toHaveBeenCalledWith(
      'verification.events',
      '{"eventId":"event-1"}',
    );
  });

  it('dispatches a channel message to every registered handler', async () => {
    const firstHandler = jest.fn();
    const secondHandler = jest.fn();
    await service.subscribe('verification.events', firstHandler);
    await service.subscribe('verification.events', secondHandler);

    messageHandler?.('verification.events', '{"eventId":"event-1"}');
    await new Promise((resolve) => setImmediate(resolve));

    expect(subscriber.subscribe).toHaveBeenCalledTimes(1);
    expect(firstHandler).toHaveBeenCalledWith({ eventId: 'event-1' });
    expect(secondHandler).toHaveBeenCalledWith({ eventId: 'event-1' });
  });

  it('unsubscribes after the final handler is removed', async () => {
    const handler = jest.fn();
    await service.subscribe('verification.events', handler);
    await service.unsubscribe('verification.events', handler);

    expect(subscriber.unsubscribe).toHaveBeenCalledWith('verification.events');
  });
});
