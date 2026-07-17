/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import {
  LivenessCheckActivationMode,
  RiskLevel,
  RiskType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RiskGeoService } from '../risk-geo/risk-geo.service';
import { UserRisksService } from './user-risks.service';

describe('UserRisksService', () => {
  let service: UserRisksService;
  let prisma: typeof mockPrisma;

  const mockPrisma = {
    $transaction: jest.fn((value: ((tx: typeof mockPrisma) => Promise<unknown>) | Promise<unknown>[]) =>
      typeof value === 'function' ? value(mockPrisma) : Promise.all(value),
    ),
    userRisk: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    userRiskEvent: { create: jest.fn() },
    processedUserEvent: { findUnique: jest.fn(), upsert: jest.fn() },
  };
  const mockRiskGeo = {
    evaluate: jest.fn(({ } = {} as never) => ({
      riskLevel: RiskLevel.HIGH,
      district: 'KEMAYORAN',
      riskScore: 0.9,
      riskPolicyVersion: 'jakarta-kecamatan-v2',
      outsideCoverage: false,
    })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserRisksService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RiskGeoService, useValue: mockRiskGeo },
      ],
    }).compile();

    service = module.get<UserRisksService>(UserRisksService);
    prisma = mockPrisma;
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-17T12:00:00.000Z'));
    jest.clearAllMocks();
    prisma.userRisk.upsert.mockResolvedValue({});
    prisma.userRiskEvent.create.mockResolvedValue({});
    prisma.processedUserEvent.findUnique.mockResolvedValue(null);
  });

  afterEach(() => jest.useRealTimers());

  it('auto-enables High-risk area protection on a safe-to-high transition', async () => {
    prisma.userRisk.findUnique.mockResolvedValue(null);
    await service.evaluateLocationRisk('user-1', -1.23, -4.56, new Date(), 'group', 'event', 1, 'location');

    expect(prisma.userRisk.upsert.mock.calls[0][0].create).toMatchObject({
      riskLevel: RiskLevel.HIGH,
      livenessCheckActivationMode: LivenessCheckActivationMode.AUTO,
    });
  });

  it('respects manual OFF for the current high-risk-area incident', async () => {
    prisma.userRisk.findUnique.mockResolvedValue({
      userId: 'user-1',
      riskType: RiskType.HIGH_RISK_AREA,
      riskLevel: RiskLevel.HIGH,
      livenessCheckActivationMode: LivenessCheckActivationMode.OFF,
    });
    await service.evaluateLocationRisk('user-1', -1.23, -4.56, new Date(), 'group', 'event', 1, 'location');

    expect(prisma.userRisk.upsert.mock.calls[0][0].update).toMatchObject({
      livenessCheckActivationMode: LivenessCheckActivationMode.OFF,
    });
  });

  it('turns an automatic High-risk area toggle off after returning safe', async () => {
    prisma.userRisk.findUnique.mockResolvedValue({
      userId: 'user-1',
      riskType: RiskType.HIGH_RISK_AREA,
      riskLevel: RiskLevel.CRITICAL,
      livenessCheckActivationMode: LivenessCheckActivationMode.AUTO,
    });
    mockRiskGeo.evaluate.mockReturnValueOnce({ riskLevel: RiskLevel.LOW, district: null, riskScore: null, riskPolicyVersion: null, outsideCoverage: true });
    await service.evaluateLocationRisk('user-1', 1.23, 4.56, new Date(), 'group', 'event', 1, 'location');

    expect(prisma.userRisk.upsert.mock.calls[0][0].update).toMatchObject({
      riskLevel: RiskLevel.LOW,
      livenessCheckActivationMode: LivenessCheckActivationMode.OFF,
    });
  });

  it('keeps manually enabled protection active after a safe location update', async () => {
    prisma.userRisk.findUnique.mockResolvedValue({
      userId: 'user-1',
      riskType: RiskType.HIGH_RISK_AREA,
      riskLevel: RiskLevel.HIGH,
      livenessCheckActivationMode: LivenessCheckActivationMode.MANUAL,
    });
    mockRiskGeo.evaluate.mockReturnValueOnce({ riskLevel: RiskLevel.LOW, district: null, riskScore: null, riskPolicyVersion: null, outsideCoverage: true });
    await service.evaluateLocationRisk('user-1', 1.23, 4.56, new Date(), 'group', 'event', 1, 'location');

    expect(prisma.userRisk.upsert.mock.calls[0][0].update).toMatchObject({
      livenessCheckActivationMode: LivenessCheckActivationMode.MANUAL,
    });
  });

  it('records a manual ON selection', async () => {
    await service.setLivenessCheckEnabled('user-1', RiskType.DISASTER, true);

    expect(prisma.userRisk.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          livenessCheckActivationMode: LivenessCheckActivationMode.MANUAL,
        }),
        update: {
          livenessCheckActivationMode: LivenessCheckActivationMode.MANUAL,
        },
      }),
    );
  });

  it('returns both Protect Me types, defaulting unseen types to OFF', async () => {
    prisma.userRisk.findMany.mockResolvedValue([
      {
        riskType: RiskType.HIGH_RISK_AREA,
        riskLevel: RiskLevel.HIGH,
        livenessCheckActivationMode: LivenessCheckActivationMode.AUTO,
      },
    ]);

    await expect(service.getLivenessCheckStatuses('user-1')).resolves.toEqual([
      {
        riskType: RiskType.HIGH_RISK_AREA,
        riskLevel: RiskLevel.HIGH,
        livenessCheckActivationMode: LivenessCheckActivationMode.AUTO,
      },
      {
        riskType: RiskType.DISASTER,
        riskLevel: RiskLevel.NONE,
        livenessCheckActivationMode: LivenessCheckActivationMode.OFF,
      },
    ]);
  });

  it('auto-enables Disaster protection for every new affecting disaster', async () => {
    await service.setDisasterRisk('user-1', RiskLevel.HIGH, new Date());

    expect(prisma.userRisk.upsert.mock.calls[0][0].update).toMatchObject({
      livenessCheckActivationMode: LivenessCheckActivationMode.AUTO,
    });
  });

  it('keeps a liveness toggle active after an affirmative response', async () => {
    prisma.userRisk.findUnique.mockResolvedValue({
      userId: 'user-1',
      riskType: RiskType.DISASTER,
      riskLevel: RiskLevel.HIGH,
      livenessCheckActivationMode: LivenessCheckActivationMode.MANUAL,
    });

    await service.respondToLivenessCheck('user-1', RiskType.DISASTER, true);

    expect(prisma.userRisk.upsert.mock.calls[0][0].update).toMatchObject({
      riskLevel: RiskLevel.NONE,
      livenessCheckActivationMode: LivenessCheckActivationMode.MANUAL,
    });
  });

  it('excludes accident risk from Protect Me controls', async () => {
    await expect(
      service.setLivenessCheckEnabled('user-1', RiskType.ACCIDENT, true),
    ).rejects.toThrow('Risk type does not support Protect Me.');
  });

  it('clears accident risk after an affirmative fall response', async () => {
    prisma.userRisk.findUnique.mockResolvedValue({
      userId: 'user-1',
      riskType: RiskType.ACCIDENT,
      riskLevel: RiskLevel.CRITICAL,
      livenessCheckActivationMode: LivenessCheckActivationMode.OFF,
    });

    await service.respondToLivenessCheck('user-1', RiskType.ACCIDENT, true);

    expect(prisma.userRisk.upsert.mock.calls[0][0].update).toMatchObject({
      riskLevel: RiskLevel.NONE,
      livenessCheckActivationMode: LivenessCheckActivationMode.OFF,
    });
  });
});
