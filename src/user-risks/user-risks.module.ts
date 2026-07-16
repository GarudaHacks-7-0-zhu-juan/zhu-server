import { Module } from '@nestjs/common';
import { UserRisksController } from './user-risks.controller';
import { UserRisksService } from './user-risks.service';

@Module({
  controllers: [UserRisksController],
  providers: [UserRisksService],
  exports: [UserRisksService],
})
export class UserRisksModule {}
