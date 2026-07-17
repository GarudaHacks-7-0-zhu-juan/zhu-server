import { Test, TestingModule } from '@nestjs/testing';
import {
  AccidentEventType,
  RiskLevel,
  RiskType,
  UserAccidentEvent,
} from '@prisma/client';
import { GuardianNotificationService } from '../guardian-notification/guardian-notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { UserRisksService } from '../user-risks/user-risks.service';
import { AccidentsService } from './accidents.service';

describe('AccidentsService', () => {
  let service: AccidentsService;
  let prisma: PrismaService;

  const mockPrisma = {
    userAccidentEvent: {
      create: jest.fn(),
    },
  };
  const mockUserRisks = { setAccidentRisk: jest.fn() };
  const mockPush = { sendLivenessCheck: jest.fn() };
  const mockGuardianNotifications = { dispatchFallDetected: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccidentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: UserRisksService, useValue: mockUserRisks },
        { provide: PushService, useValue: mockPush },
        {
          provide: GuardianNotificationService,
          useValue: mockGuardianNotifications,
        },
      ],
    }).compile();

    service = module.get<AccidentsService>(AccidentsService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('records a fall event', async () => {
    const detectedAt = new Date('2026-07-16T12:00:00.000Z');
    const mockEvent = {
      id: 'event-1',
      userId: 'user-1',
      eventType: AccidentEventType.FALL_DETECTED,
      detectedAt,
    } as UserAccidentEvent;

    const createSpy = jest
      .spyOn(prisma.userAccidentEvent, 'create')
      .mockResolvedValue(mockEvent);

    const result = await service.recordFall('user-1', detectedAt);

    expect(createSpy).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        eventType: AccidentEventType.FALL_DETECTED,
        detectedAt,
      },
    });
    expect(mockUserRisks.setAccidentRisk).toHaveBeenCalledWith(
      'user-1',
      RiskLevel.CRITICAL,
      detectedAt,
    );
    expect(mockPush.sendLivenessCheck).toHaveBeenCalledWith(
      'user-1',
      RiskType.ACCIDENT,
    );
    expect(mockGuardianNotifications.dispatchFallDetected).toHaveBeenCalledWith(
      'user-1',
      'event-1',
    );
    expect(result).toBe(mockEvent);
  });

  it('records a movement event', async () => {
    const detectedAt = new Date('2026-07-16T12:00:00.000Z');
    const mockEvent = {
      id: 'event-2',
      userId: 'user-1',
      eventType: AccidentEventType.MOVEMENT,
      detectedAt,
    } as UserAccidentEvent;

    const createSpy = jest
      .spyOn(prisma.userAccidentEvent, 'create')
      .mockResolvedValue(mockEvent);

    const result = await service.recordMovement('user-1', detectedAt);

    expect(createSpy).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        eventType: AccidentEventType.MOVEMENT,
        detectedAt,
      },
    });
    expect(result).toBe(mockEvent);
  });
});
