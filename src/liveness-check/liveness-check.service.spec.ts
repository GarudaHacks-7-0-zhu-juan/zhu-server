import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RiskLevel, RiskType, UserRisk } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import {
  DEFAULT_LIVENESS_CHECK_RISK_AGE_SECONDS,
  LIVENESS_CHECK_RISK_AGE_SECONDS_ENV,
} from './liveness-check.constants';
import { LivenessCheckService } from './liveness-check.service';

describe('LivenessCheckService', () => {
  let service: LivenessCheckService;
  let prisma: PrismaService;

  const mockPrisma = {
    $queryRaw: jest.fn(),
    userRiskNotification: { create: jest.fn() },
  };
  const mockPush = { sendLivenessCheck: jest.fn() };

  const mockConfig = {
    get: jest.fn(),
  };

  const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LivenessCheckService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: PushService, useValue: mockPush },
      ],
    }).compile();

    service = module.get<LivenessCheckService>(LivenessCheckService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-16T12:00:00.000Z'));

    jest.clearAllMocks();
    mockPush.sendLivenessCheck.mockResolvedValue({ sent: 1, failed: 0 });
    consoleSpy.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    consoleSpy.mockRestore();
  });

  describe('findUsersNeedingCheck', () => {
    it('uses the configured risk age threshold', async () => {
      mockConfig.get.mockImplementation((key: string) => {
        if (key === LIVENESS_CHECK_RISK_AGE_SECONDS_ENV) return '120';
        return undefined;
      });
      mockPrisma.$queryRaw.mockResolvedValue([]);
      const querySpy = jest.spyOn(prisma, '$queryRaw');

      await service.findUsersNeedingCheck();

      expect(querySpy).toHaveBeenCalled();
      const call = querySpy.mock.calls[0];
      expect(call).toContain(120);
    });

    it('falls back to the default risk age threshold', async () => {
      mockConfig.get.mockReturnValue(undefined);
      mockPrisma.$queryRaw.mockResolvedValue([]);
      const querySpy = jest.spyOn(prisma, '$queryRaw');

      await service.findUsersNeedingCheck();

      expect(querySpy).toHaveBeenCalled();
      const call = querySpy.mock.calls[0];
      expect(call).toContain(DEFAULT_LIVENESS_CHECK_RISK_AGE_SECONDS);
    });
  });

  describe('dispatchCheckBatch', () => {
    it('logs matched users and upserts a notification per user', async () => {
      const now = new Date();
      const users = [
        {
          userId: 'user-1',
          riskType: RiskType.HIGH_RISK_AREA,
          riskLevel: RiskLevel.HIGH,
          updatedAt: now,
        },
        {
          userId: 'user-2',
          riskType: RiskType.HIGH_RISK_AREA,
          riskLevel: RiskLevel.CRITICAL,
          updatedAt: now,
        },
      ] as UserRisk[];

      mockPrisma.$queryRaw.mockResolvedValue(users);
      const createSpy = jest.spyOn(prisma.userRiskNotification, 'create');

      await service.dispatchCheckBatch();

      expect(consoleSpy).toHaveBeenCalledWith(
        `[liveness-check] ${now.toISOString()} - running liveness check dispatch`,
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        `[liveness-check] ${now.toISOString()} - 2 user(s) need a liveness check`,
        [
          { userId: 'user-1', riskLevel: RiskLevel.HIGH },
          { userId: 'user-2', riskLevel: RiskLevel.CRITICAL },
        ],
      );

      expect(mockPush.sendLivenessCheck).toHaveBeenCalledTimes(2);
      expect(mockPush.sendLivenessCheck).toHaveBeenNthCalledWith(
        1,
        'user-1',
        RiskType.HIGH_RISK_AREA,
      );
      expect(mockPush.sendLivenessCheck).toHaveBeenNthCalledWith(
        2,
        'user-2',
        RiskType.HIGH_RISK_AREA,
      );
      expect(createSpy).toHaveBeenCalledTimes(2);
      expect(createSpy).toHaveBeenNthCalledWith(1, {
        data: {
          userId: 'user-1',
          riskType: RiskType.HIGH_RISK_AREA,
          sentAt: now,
        },
      });
      expect(createSpy).toHaveBeenNthCalledWith(2, {
        data: {
          userId: 'user-2',
          riskType: RiskType.HIGH_RISK_AREA,
          sentAt: now,
        },
      });
    });

    it('does nothing when no users need a check', async () => {
      const now = new Date();
      mockPrisma.$queryRaw.mockResolvedValue([]);
      const createSpy = jest.spyOn(prisma.userRiskNotification, 'create');

      await service.dispatchCheckBatch();

      expect(consoleSpy).toHaveBeenCalledWith(
        `[liveness-check] ${now.toISOString()} - running liveness check dispatch`,
      );
      expect(createSpy).not.toHaveBeenCalled();
    });

    it('does not record a notification when every device delivery fails', async () => {
      const users = [
        {
          userId: 'user-1',
          riskType: RiskType.HIGH_RISK_AREA,
          riskLevel: RiskLevel.HIGH,
        },
      ] as UserRisk[];
      mockPrisma.$queryRaw.mockResolvedValue(users);
      mockPush.sendLivenessCheck.mockResolvedValue({ sent: 0, failed: 1 });
      const createSpy = jest.spyOn(prisma.userRiskNotification, 'create');

      await service.dispatchCheckBatch();

      expect(createSpy).not.toHaveBeenCalled();
    });
  });
});
