import { Module } from '@nestjs/common';
import { UserRisksModule } from '../user-risks/user-risks.module';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';

@Module({
  controllers: [LocationsController],
  imports: [UserRisksModule],
  providers: [LocationsService],
})
export class LocationsModule {}
