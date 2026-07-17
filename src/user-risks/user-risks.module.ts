import { Module } from '@nestjs/common';
import { GuardianNotificationModule } from '../guardian-notification/guardian-notification.module';
import { RiskGeoModule } from '../risk-geo/risk-geo.module';
import { UserRisksController } from './user-risks.controller';
import { UserRisksService } from './user-risks.service';

@Module({
  imports: [GuardianNotificationModule, RiskGeoModule],
  controllers: [UserRisksController],
  providers: [UserRisksService],
  exports: [UserRisksService],
})
export class UserRisksModule {}
