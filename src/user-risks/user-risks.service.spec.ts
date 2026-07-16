import { Test, TestingModule } from '@nestjs/testing';
import { RiskLevel, RiskType, UserRisk, UserRiskEvent } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UserRisksService } from './user-risks.service';

describe('UserRisksService', () => {
  let service: UserRisksService;
  let prisma: PrismaService;

  const mockPrisma = {
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    userRisk: { upsert: jest.fn(), findMany: jest.fn() },
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

    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-16T12:00:00.000Z'));

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
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
          livenessCheckEnabled: false,
          updatedAt: detectedAt,
        },
        update: {
          riskLevel: RiskLevel.LOW,
          livenessCheckEnabled: false,
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

    it('enables liveness checks for HIGH/CRITICAL and disables otherwise', async () => {
      const detectedAt = new Date('2026-07-16T12:00:00.000Z');
      const upsertSpy = jest
        .spyOn(prisma.userRisk, 'upsert')
        .mockResolvedValue({} as UserRisk);
      jest
        .spyOn(prisma.userRiskEvent, 'create')
        .mockResolvedValue({} as UserRiskEvent);

      jest.spyOn(Math, 'random').mockReturnValueOnce(0.75); // index 3 = CRITICAL
      await service.evaluateRisk('user-1', 0, 0, detectedAt);
      expect(upsertSpy.mock.calls[0][0].create.livenessCheckEnabled).toBe(true);
      expect(upsertSpy.mock.calls[0][0].update.livenessCheckEnabled).toBe(true);

      jest.spyOn(Math, 'random').mockReturnValueOnce(0); // index 0 = LOW
      await service.evaluateRisk('user-1', 0, 0, detectedAt);
      expect(upsertSpy.mock.calls[1][0].create.livenessCheckEnabled).toBe(
        false,
      );
      expect(upsertSpy.mock.calls[1][0].update.livenessCheckEnabled).toBe(
        false,
      );
    });
  });

  describe('setLivenessCheckEnabled', () => {
    it('upserts the toggle for an existing risk row', async () => {
      const userId = 'user-1';
      const riskType = RiskType.HIGH_RISK_AREA;
      const mockRisk = {
        userId,
        riskType,
        riskLevel: RiskLevel.HIGH,
        livenessCheckEnabled: false,
      } as UserRisk;

      const upsertSpy = jest
        .spyOn(prisma.userRisk, 'upsert')
        .mockResolvedValue(mockRisk);

      const result = await service.setLivenessCheckEnabled(
        userId,
        riskType,
        false,
      );

      expect(upsertSpy).toHaveBeenCalledWith({
        where: {
          userId_riskType: {
            userId,
            riskType,
          },
        },
        create: {
          userId,
          riskType,
          riskLevel: RiskLevel.NONE,
          livenessCheckEnabled: false,
          updatedAt: new Date(),
        },
        update: {
          livenessCheckEnabled: false,
        },
      });
      expect(result).toBe(mockRisk);
    });
  });

  describe('getLivenessCheckStatuses', () => {
    it('returns liveness flags for all risk types of the user', async () => {
      const userId = 'user-1';
      const rows = [
        { riskType: RiskType.HIGH_RISK_AREA, livenessCheckEnabled: true },
        { riskType: RiskType.DISASTER, livenessCheckEnabled: false },
      ];

      const findManySpy = jest
        .spyOn(prisma.userRisk, 'findMany')
        .mockResolvedValue(rows as UserRisk[]);

      const result = await service.getLivenessCheckStatuses(userId);

      expect(findManySpy).toHaveBeenCalledWith({
        where: { userId },
        select: {
          riskType: true,
          livenessCheckEnabled: true,
        },
      });
      expect(result).toEqual(rows);
    });
  });

  describe('respondToLivenessCheck', () => {
    it('resets the risk level to NONE and appends a UserRiskEvent', async () => {
      const userId = 'user-1';
      const riskType = RiskType.HIGH_RISK_AREA;
      const respondedAt = new Date('2026-07-16T12:00:00.000Z');

      const mockRisk = {
        userId,
        riskType,
        riskLevel: RiskLevel.NONE,
        updatedAt: respondedAt,
      } as UserRisk;

      const mockEvent = {
        id: 'risk-event-1',
        userId,
        riskType,
        riskLevel: RiskLevel.NONE,
        detectedAt: respondedAt,
      } as UserRiskEvent;

      const upsertSpy = jest
        .spyOn(prisma.userRisk, 'upsert')
        .mockResolvedValue(mockRisk);
      const createSpy = jest
        .spyOn(prisma.userRiskEvent, 'create')
        .mockResolvedValue(mockEvent);

      const result = await service.respondToLivenessCheck(userId, riskType);

      expect(upsertSpy).toHaveBeenCalledWith({
        where: {
          userId_riskType: {
            userId,
            riskType,
          },
        },
        create: {
          userId,
          riskType,
          riskLevel: RiskLevel.NONE,
          livenessCheckEnabled: false,
          updatedAt: respondedAt,
        },
        update: {
          riskLevel: RiskLevel.NONE,
          livenessCheckEnabled: false,
          updatedAt: respondedAt,
        },
      });
      expect(createSpy).toHaveBeenCalledWith({
        data: {
          userId,
          riskType,
          riskLevel: RiskLevel.NONE,
          detectedAt: respondedAt,
        },
      });
      expect(result).toEqual({ risk: mockRisk, event: mockEvent });
    });
  });
});
