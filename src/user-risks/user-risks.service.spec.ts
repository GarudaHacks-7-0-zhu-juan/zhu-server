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
    const detectedAt = new Date('2026-07-16T12:00:00.000Z');

    beforeEach(() => {
      jest.spyOn(prisma.userRisk, 'upsert').mockResolvedValue({} as UserRisk);
      jest
        .spyOn(prisma.userRiskEvent, 'create')
        .mockResolvedValue({} as UserRiskEvent);
    });

    it('marks negative-lat-lon coordinates as HIGH/CRITICAL risk and enables liveness checks', async () => {
      const upsertSpy = jest.spyOn(prisma.userRisk, 'upsert');
      jest.spyOn(Math, 'random').mockReturnValue(0); // picks HIGH

      await service.evaluateRisk('user-1', -1.23, -4.56, detectedAt);

      expect(upsertSpy.mock.calls[0][0].create.riskLevel).toBe(RiskLevel.HIGH);
      expect(upsertSpy.mock.calls[0][0].create.livenessCheckEnabled).toBe(true);
      expect(upsertSpy.mock.calls[0][0].update.livenessCheckEnabled).toBe(true);
    });

    it('marks positive-lat-lon coordinates as LOW/NONE risk and disables liveness checks', async () => {
      const upsertSpy = jest.spyOn(prisma.userRisk, 'upsert');
      jest.spyOn(Math, 'random').mockReturnValue(0); // picks LOW

      await service.evaluateRisk('user-1', 1.23, 4.56, detectedAt);

      expect(upsertSpy.mock.calls[0][0].create.riskLevel).toBe(RiskLevel.LOW);
      expect(upsertSpy.mock.calls[0][0].create.livenessCheckEnabled).toBe(
        false,
      );
      expect(upsertSpy.mock.calls[0][0].update.livenessCheckEnabled).toBe(
        false,
      );
    });

    it('treats mixed-sign coordinates as LOW/NONE risk and disables liveness checks', async () => {
      const upsertSpy = jest.spyOn(prisma.userRisk, 'upsert');
      jest.spyOn(Math, 'random').mockReturnValue(1); // picks NONE

      await service.evaluateRisk('user-1', -1.23, 4.56, detectedAt);

      expect(upsertSpy.mock.calls[0][0].create.riskLevel).toBe(RiskLevel.NONE);
      expect(upsertSpy.mock.calls[0][0].create.livenessCheckEnabled).toBe(
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

  describe('setDisasterRisk', () => {
    it('upserts DISASTER UserRisk and appends a UserRiskEvent', async () => {
      const userId = 'user-1';
      const detectedAt = new Date('2026-07-16T12:00:00.000Z');

      const mockRisk = {
        userId,
        riskType: RiskType.DISASTER,
        riskLevel: RiskLevel.HIGH,
        updatedAt: detectedAt,
      } as UserRisk;

      const mockEvent = {
        id: 'disaster-event-1',
        userId,
        riskType: RiskType.DISASTER,
        riskLevel: RiskLevel.HIGH,
        detectedAt,
      } as UserRiskEvent;

      const upsertSpy = jest
        .spyOn(prisma.userRisk, 'upsert')
        .mockResolvedValue(mockRisk);
      const createSpy = jest
        .spyOn(prisma.userRiskEvent, 'create')
        .mockResolvedValue(mockEvent);

      const result = await service.setDisasterRisk(
        userId,
        RiskLevel.HIGH,
        detectedAt,
      );

      expect(upsertSpy).toHaveBeenCalledWith({
        where: {
          userId_riskType: {
            userId,
            riskType: RiskType.DISASTER,
          },
        },
        create: {
          userId,
          riskType: RiskType.DISASTER,
          riskLevel: RiskLevel.HIGH,
          livenessCheckEnabled: true,
          updatedAt: detectedAt,
        },
        update: {
          riskLevel: RiskLevel.HIGH,
          livenessCheckEnabled: true,
          updatedAt: detectedAt,
        },
      });
      expect(createSpy).toHaveBeenCalledWith({
        data: {
          userId,
          riskType: RiskType.DISASTER,
          riskLevel: RiskLevel.HIGH,
          detectedAt,
        },
      });
      expect(result).toEqual({ risk: mockRisk, event: mockEvent });
    });

    it('disables liveness check for LOW disaster risk', async () => {
      const upsertSpy = jest
        .spyOn(prisma.userRisk, 'upsert')
        .mockResolvedValue({} as UserRisk);
      jest
        .spyOn(prisma.userRiskEvent, 'create')
        .mockResolvedValue({} as UserRiskEvent);

      await service.setDisasterRisk(
        'user-1',
        RiskLevel.LOW,
        new Date('2026-07-16T12:00:00.000Z'),
      );

      expect(upsertSpy.mock.calls[0][0].create.livenessCheckEnabled).toBe(
        false,
      );
      expect(upsertSpy.mock.calls[0][0].update.livenessCheckEnabled).toBe(
        false,
      );
    });
  });

  describe('setAccidentRisk', () => {
    it('upserts ACCIDENT UserRisk and appends a UserRiskEvent', async () => {
      const userId = 'user-1';
      const detectedAt = new Date('2026-07-16T12:00:00.000Z');

      const mockRisk = {
        userId,
        riskType: RiskType.ACCIDENT,
        riskLevel: RiskLevel.CRITICAL,
        updatedAt: detectedAt,
      } as UserRisk;

      const mockEvent = {
        id: 'accident-event-1',
        userId,
        riskType: RiskType.ACCIDENT,
        riskLevel: RiskLevel.CRITICAL,
        detectedAt,
      } as UserRiskEvent;

      const upsertSpy = jest
        .spyOn(prisma.userRisk, 'upsert')
        .mockResolvedValue(mockRisk);
      const createSpy = jest
        .spyOn(prisma.userRiskEvent, 'create')
        .mockResolvedValue(mockEvent);

      const result = await service.setAccidentRisk(
        userId,
        RiskLevel.CRITICAL,
        detectedAt,
      );

      expect(upsertSpy).toHaveBeenCalledWith({
        where: {
          userId_riskType: {
            userId,
            riskType: RiskType.ACCIDENT,
          },
        },
        create: {
          userId,
          riskType: RiskType.ACCIDENT,
          riskLevel: RiskLevel.CRITICAL,
          livenessCheckEnabled: true,
          updatedAt: detectedAt,
        },
        update: {
          riskLevel: RiskLevel.CRITICAL,
          livenessCheckEnabled: true,
          updatedAt: detectedAt,
        },
      });
      expect(createSpy).toHaveBeenCalledWith({
        data: {
          userId,
          riskType: RiskType.ACCIDENT,
          riskLevel: RiskLevel.CRITICAL,
          detectedAt,
        },
      });
      expect(result).toEqual({ risk: mockRisk, event: mockEvent });
    });

    it('disables liveness check for LOW accident risk', async () => {
      const upsertSpy = jest
        .spyOn(prisma.userRisk, 'upsert')
        .mockResolvedValue({} as UserRisk);
      jest
        .spyOn(prisma.userRiskEvent, 'create')
        .mockResolvedValue({} as UserRiskEvent);

      await service.setAccidentRisk(
        'user-1',
        RiskLevel.LOW,
        new Date('2026-07-16T12:00:00.000Z'),
      );

      expect(upsertSpy.mock.calls[0][0].create.livenessCheckEnabled).toBe(
        false,
      );
      expect(upsertSpy.mock.calls[0][0].update.livenessCheckEnabled).toBe(
        false,
      );
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
