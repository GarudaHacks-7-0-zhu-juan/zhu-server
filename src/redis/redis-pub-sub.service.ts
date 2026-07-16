import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_PUBLISHER, REDIS_SUBSCRIBER } from './redis.constants';

export type RedisEventHandler<T> = (payload: T) => void | Promise<void>;

@Injectable()
export class RedisPubSubService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisPubSubService.name);
  private readonly handlers = new Map<
    string,
    Set<RedisEventHandler<unknown>>
  >();

  constructor(
    @Inject(REDIS_PUBLISHER) private readonly publisher: Redis,
    @Inject(REDIS_SUBSCRIBER) private readonly subscriber: Redis,
  ) {
    this.subscriber.on('message', (channel: string, message: string) => {
      void this.dispatch(channel, message);
    });
  }

  publish<T>(channel: string, payload: T): Promise<number> {
    return this.publisher.publish(channel, JSON.stringify(payload));
  }

  async subscribe<T>(
    channel: string,
    handler: RedisEventHandler<T>,
  ): Promise<void> {
    const handlers = this.handlers.get(channel) ?? new Set();
    const wasEmpty = handlers.size === 0;
    handlers.add(handler);
    this.handlers.set(channel, handlers);

    if (wasEmpty) {
      await this.subscriber.subscribe(channel);
    }
  }

  async unsubscribe<T>(
    channel: string,
    handler: RedisEventHandler<T>,
  ): Promise<void> {
    const handlers = this.handlers.get(channel);
    if (!handlers) {
      return;
    }

    handlers.delete(handler);
    if (handlers.size === 0) {
      this.handlers.delete(channel);
      await this.subscriber.unsubscribe(channel);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.publisher.quit(), this.subscriber.quit()]);
  }

  private async dispatch(channel: string, message: string): Promise<void> {
    const handlers = this.handlers.get(channel);
    if (!handlers) {
      return;
    }

    let payload: unknown;
    try {
      payload = JSON.parse(message) as unknown;
    } catch {
      this.logger.warn(`Ignored invalid JSON on Redis channel "${channel}"`);
      return;
    }

    const results = await Promise.allSettled(
      [...handlers].map((handler) =>
        Promise.resolve().then(() => handler(payload)),
      ),
    );
    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.error(
          `Redis handler failed for channel "${channel}"`,
          result.reason,
        );
      }
    }
  }
}
