import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RiskLevel, RiskType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UserRisksService } from '../user-risks/user-risks.service';
import { AccidentMonitorService } from './accident-monitor.service';

const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

describe('AccidentMonitorService', () => {
  let service: AccidentMonitorService;

  const mockPrisma = {
    $queryRaw: jest.fn(),
    userRisk: {
      findUnique: jest.fn(),
    },
  };

  const mockUserRisks = {
    setAccidentRisk: jest.fn(),
  };

  const mockConfig = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccidentMonitorService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: UserRisksService, useValue: mockUserRisks },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<AccidentMonitorService>(AccidentMonitorService);

    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-16T12:00:00.000Z'));
    jest.clearAllMocks();
    consoleSpy.mockClear();
    mockConfig.get.mockReturnValue(undefined);
    mockUserRisks.setAccidentRisk.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    consoleSpy.mockRestore();
  });

  describe('fall detection', () => {
    it('sets ACCIDENT risk to CRITICAL for unprocessed falls', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([
        { userId: 'user-1', detectedAt: new Date('2026-07-16T11:00:00.000Z') },
      ]);
      mockPrisma.$queryRaw.mockResolvedValueOnce([]);

      const result = await service.monitor();

      expect(result.fallDetectedCount).toBe(1);
      expect(mockUserRisks.setAccidentRisk).toHaveBeenCalledWith(
        'user-1',
        RiskLevel.CRITICAL,
        new Date('2026-07-16T11:00:00.000Z'),
      );
    });

    it('does nothing when there are no unprocessed falls', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([]);
      mockPrisma.$queryRaw.mockResolvedValueOnce([]);

      const result = await service.monitor();

      expect(result.fallDetectedCount).toBe(0);
      expect(mockUserRisks.setAccidentRisk).not.toHaveBeenCalled();
    });
  });

  describe('no-movement check', () => {
    it('sets ACCIDENT risk to HIGH when movement is stale and risk is NONE', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([]);
      mockPrisma.$queryRaw.mockResolvedValueOnce([
        {
          userId: 'user-1',
          lastMovementAt: new Date('2026-07-16T05:00:00.000Z'),
        },
      ]);
      mockPrisma.userRisk.findUnique.mockResolvedValue({
        userId: 'user-1',
        riskType: RiskType.ACCIDENT,
        riskLevel: RiskLevel.NONE,
        updatedAt: new Date('2026-07-16T05:00:00.000Z'),
      });

      const result = await service.monitor();

      expect(result.noMovementCount).toBe(1);
      expect(mockUserRisks.setAccidentRisk).toHaveBeenCalledWith(
        'user-1',
        RiskLevel.HIGH,
        new Date('2026-07-16T12:00:00.000Z'),
      );
    });

    it('skips users already flagged HIGH or CRITICAL', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([]);
      mockPrisma.$queryRaw.mockResolvedValueOnce([
        {
          userId: 'user-1',
          lastMovementAt: new Date('2026-07-16T05:00:00.000Z'),
        },
      ]);
      mockPrisma.userRisk.findUnique.mockResolvedValue({
        userId: 'user-1',
        riskType: RiskType.ACCIDENT,
        riskLevel: RiskLevel.HIGH,
        updatedAt: new Date('2026-07-16T05:00:00.000Z'),
      });

      const result = await service.monitor();

      expect(result.noMovementCount).toBe(0);
      expect(mockUserRisks.setAccidentRisk).not.toHaveBeenCalled();
    });

    it('skips users who recently responded (within grace period)', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([]);
      mockPrisma.$queryRaw.mockResolvedValueOnce([
        {
          userId: 'user-1',
          lastMovementAt: new Date('2026-07-16T05:00:00.000Z'),
        },
      ]);
      mockPrisma.userRisk.findUnique.mockResolvedValue({
        userId: 'user-1',
        riskType: RiskType.ACCIDENT,
        riskLevel: RiskLevel.NONE,
        updatedAt: new Date('2026-07-16T11:30:00.000Z'),
      });

      const result = await service.monitor();

      expect(result.noMovementCount).toBe(0);
      expect(mockUserRisks.setAccidentRisk).not.toHaveBeenCalled();
    });

    it('re-flags users after the grace period expires', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([]);
      mockPrisma.$queryRaw.mockResolvedValueOnce([
        {
          userId: 'user-1',
          lastMovementAt: new Date('2026-07-16T05:00:00.000Z'),
        },
      ]);
      mockPrisma.userRisk.findUnique.mockResolvedValue({
        userId: 'user-1',
        riskType: RiskType.ACCIDENT,
        riskLevel: RiskLevel.NONE,
        updatedAt: new Date('2026-07-16T05:00:00.000Z'),
      });

      const result = await service.monitor();

      expect(result.noMovementCount).toBe(1);
    });
  });
});
