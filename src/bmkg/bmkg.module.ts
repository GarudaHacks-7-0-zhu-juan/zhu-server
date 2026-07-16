import { Module } from '@nestjs/common';
import { BmkgGateway } from './bmkg.gateway';

@Module({
  providers: [BmkgGateway],
  exports: [BmkgGateway],
})
export class BmkgModule {}
