import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_PUBLISHER, REDIS_SUBSCRIBER } from './redis.constants';
import { RedisPubSubService } from './redis-pub-sub.service';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_PUBLISHER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Redis(config.getOrThrow<string>('REDIS_URL')),
    },
    {
      provide: REDIS_SUBSCRIBER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Redis(config.getOrThrow<string>('REDIS_URL')),
    },
    RedisPubSubService,
  ],
  exports: [RedisPubSubService],
})
export class RedisModule {}
