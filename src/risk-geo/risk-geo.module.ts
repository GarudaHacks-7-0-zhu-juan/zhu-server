import { Module } from '@nestjs/common';
import { RiskGeoService } from './risk-geo.service';

@Module({ providers: [RiskGeoService], exports: [RiskGeoService] })
export class RiskGeoModule {}
