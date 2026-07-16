import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BmkgModule } from './bmkg/bmkg.module';
import { EarthquakeModule } from './earthquake/earthquake.module';
import { KafkaModule } from './kafka/kafka.module';
import { LocationConsumerModule } from './location-consumer/location-consumer.module';
import { LivenessCheckModule } from './liveness-check/liveness-check.module';
import { LoggingModule } from './logging/logging.module';
import { LocationsModule } from './locations/locations.module';
import { OutboxModule } from './outbox/outbox.module';
import { PrismaModule } from './prisma/prisma.module';
import { PushModule } from './push/push.module';
import { UserRisksModule } from './user-risks/user-risks.module';
import { QueueModule } from './queue/queue.module';
import { RedisModule } from './redis/redis.module';
import { GuardiansModule } from './guardians/guardians.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggingModule,
    PrismaModule,
    RedisModule,
    QueueModule,
    KafkaModule,
    OutboxModule,
    LocationConsumerModule,
    AuthModule,
    LocationsModule,
    UserRisksModule,
    GuardiansModule,
    PushModule,
    LivenessCheckModule,
    BmkgModule,
    EarthquakeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
