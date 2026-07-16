import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { BmkgModule } from '../bmkg/bmkg.module';
import { PrismaModule } from '../prisma/prisma.module';
import { UserRisksModule } from '../user-risks/user-risks.module';
import { EARTHQUAKE_POLLING_QUEUE } from './earthquake.constants';
import { EarthquakePollerService } from './earthquake.poller';
import { EarthquakeProcessor } from './earthquake.processor';
import { EarthquakeScheduler } from './earthquake.scheduler';

@Module({
  imports: [
    BullModule.registerQueue({ name: EARTHQUAKE_POLLING_QUEUE }),
    BmkgModule,
    PrismaModule,
    UserRisksModule,
  ],
  providers: [
    EarthquakePollerService,
    EarthquakeProcessor,
    EarthquakeScheduler,
  ],
  exports: [EarthquakePollerService],
})
export class EarthquakeModule {}
