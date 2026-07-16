import { Test, TestingModule } from '@nestjs/testing';
import { RiskLevel, RiskType, UserRisk, UserRiskEvent } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UserRisksService } from './user-risks.service';

describe('UserRisksService', () => {
  let service: UserRisksService;
  let prisma: PrismaService;

  const mockPrisma = {
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    userRisk: { upsert: jest.fn() },
    userRiskEvent: { create: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserRisksService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UserRisksService>(UserRisksService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('evaluateRisk', () => {
    it('upserts UserRisk and appends UserRiskEvent with a randomized risk level', async () => {
      const userId = 'user-1';
      const latitude = 1.23;
      const longitude = 4.56;
      const detectedAt = new Date('2026-07-16T12:00:00.000Z');

      const mockRisk = {
        userId,
        riskType: RiskType.HIGH_RISK_AREA,
        riskLevel: RiskLevel.LOW,
        updatedAt: detectedAt,
      } as UserRisk;

      const mockEvent = {
        id: 'risk-event-1',
        userId,
        riskType: RiskType.HIGH_RISK_AREA,
        riskLevel: RiskLevel.LOW,
        detectedAt,
      } as UserRiskEvent;

      const upsertSpy = jest
        .spyOn(prisma.userRisk, 'upsert')
        .mockResolvedValue(mockRisk);
      const createSpy = jest
        .spyOn(prisma.userRiskEvent, 'create')
        .mockResolvedValue(mockEvent);
      jest.spyOn(Math, 'random').mockReturnValue(0);

      const result = await service.evaluateRisk(
        userId,
        latitude,
        longitude,
        detectedAt,
      );

      expect(upsertSpy).toHaveBeenCalledWith({
        where: {
          userId_riskType: {
            userId,
            riskType: RiskType.HIGH_RISK_AREA,
          },
        },
        create: {
          userId,
          riskType: RiskType.HIGH_RISK_AREA,
          riskLevel: RiskLevel.LOW,
          updatedAt: detectedAt,
        },
        update: {
          riskLevel: RiskLevel.LOW,
          updatedAt: detectedAt,
        },
      });

      expect(createSpy).toHaveBeenCalledWith({
        data: {
          userId,
          riskType: RiskType.HIGH_RISK_AREA,
          riskLevel: RiskLevel.LOW,
          detectedAt,
        },
      });

      expect(result).toEqual({ risk: mockRisk, event: mockEvent });
    });

    it('picks a valid non-NONE risk level', async () => {
      const detectedAt = new Date('2026-07-16T12:00:00.000Z');
      const validLevels = [
        RiskLevel.LOW,
        RiskLevel.MEDIUM,
        RiskLevel.HIGH,
        RiskLevel.CRITICAL,
      ];

      const upsertSpy = jest
        .spyOn(prisma.userRisk, 'upsert')
        .mockResolvedValue({} as UserRisk);
      jest
        .spyOn(prisma.userRiskEvent, 'create')
        .mockResolvedValue({} as UserRiskEvent);

      await service.evaluateRisk('user-1', 0, 0, detectedAt);

      const upsertCall = upsertSpy.mock.calls[0][0];
      expect(validLevels).toContain(upsertCall.create.riskLevel);
    });
  });
});
