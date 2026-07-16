import { Module } from '@nestjs/common';
import { UserRisksService } from './user-risks.service';

@Module({
  providers: [UserRisksService],
  exports: [UserRisksService],
})
export class UserRisksModule {}
