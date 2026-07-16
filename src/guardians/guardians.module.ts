import { Module } from '@nestjs/common';
import {
  GuardiansController,
  GuardeesController,
} from './guardians.controller';
import { GuardiansService } from './guardians.service';

@Module({
  controllers: [GuardiansController, GuardeesController],
  providers: [GuardiansService],
})
export class GuardiansModule {}
