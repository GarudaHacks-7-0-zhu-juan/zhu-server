import { RiskLevel } from '@prisma/client';
import { RiskGeoService } from './risk-geo.service';

describe('RiskGeoService', () => {
  const service = new RiskGeoService();

  beforeAll(() => service.onModuleInit());

  it('returns the pinned v2 district risk for a Kemayoran coordinate', () => {
    expect(service.evaluate(-6.1627, 106.85582)).toMatchObject({
      riskLevel: RiskLevel.CRITICAL,
      district: 'KEMAYORAN',
      riskScore: 0.9535,
      riskPolicyVersion: 'jakarta-kecamatan-v2',
      outsideCoverage: false,
    });
  });

  it('returns NONE with coverage context outside Jakarta', () => {
    expect(service.evaluate(0, 0)).toEqual({
      riskLevel: RiskLevel.NONE,
      district: null,
      riskScore: null,
      riskPolicyVersion: null,
      outsideCoverage: true,
    });
  });
});
