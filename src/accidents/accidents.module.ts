import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { GuardianNotificationModule } from '../guardian-notification/guardian-notification.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PushModule } from '../push/push.module';
import { UserRisksModule } from '../user-risks/user-risks.module';
import { ACCIDENT_MONITOR_QUEUE } from './accidents.constants';
import { AccidentMonitorProcessor } from './accident-monitor.processor';
import { AccidentMonitorScheduler } from './accident-monitor.scheduler';
import { AccidentMonitorService } from './accident-monitor.service';
import { AccidentsController } from './accidents.controller';
import { AccidentsService } from './accidents.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: ACCIDENT_MONITOR_QUEUE }),
    GuardianNotificationModule,
    PrismaModule,
    PushModule,
    UserRisksModule,
  ],
  controllers: [AccidentsController],
  providers: [
    AccidentsService,
    AccidentMonitorService,
    AccidentMonitorProcessor,
    AccidentMonitorScheduler,
  ],
  exports: [AccidentsService, AccidentMonitorService],
})
export class AccidentsModule {}
