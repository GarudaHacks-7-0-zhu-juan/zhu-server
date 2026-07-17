import { ConfigService } from '@nestjs/config';
import {
  GuardianRelationshipStatus,
  GuardianRiskNotificationTrigger,
  RiskLevel,
  RiskType,
  UserRisk,
} from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { GuardianNotificationService } from './guardian-notification.service';

describe('GuardianNotificationService', () => {
  const queue = { add: jest.fn() };
  const prisma = {
    $queryRaw: jest.fn(),
    guardianRelationship: { findMany: jest.fn() },
    guardianRiskNotification: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };
  const push = { sendGuardianRiskNotification: jest.fn() };
  const config = { get: jest.fn() };
  const service = new GuardianNotificationService(
    queue as unknown as Queue,
    prisma as unknown as PrismaService,
    push as unknown as PushService,
    config as unknown as ConfigService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockReturnValue(undefined);
    push.sendGuardianRiskNotification.mockResolvedValue({ sent: 1, failed: 0 });
    prisma.guardianRelationship.findMany.mockResolvedValue([
      {
        guardianId: 'guardian-1',
        guardee: { email: 'guardee@example.com', phoneNumber: '+628123456789' },
      },
    ]);
    prisma.guardianRiskNotification.findFirst.mockResolvedValue(null);
    prisma.guardianRiskNotification.findUnique.mockResolvedValue(null);
    prisma.guardianRiskNotification.create.mockResolvedValue({});
  });

  it('enqueues a negative response for immediate processing', async () => {
    await service.enqueueNegativeResponse({
      guardeeId: 'guardee-1',
      riskType: RiskType.DISASTER,
      responseEventId: 'event-1',
    });

    expect(queue.add).toHaveBeenCalledWith(
      'negative-response',
      {
        guardeeId: 'guardee-1',
        riskType: RiskType.DISASTER,
        responseEventId: 'event-1',
      },
      {
        jobId: 'negative-response-event-1',
        removeOnComplete: true,
      },
    );
  });

  it('immediately notifies accepted guardians for a negative response', async () => {
    await service.dispatchNegativeResponse({
      guardeeId: 'guardee-1',
      riskType: RiskType.ACCIDENT,
      responseEventId: 'event-1',
    });

    expect(prisma.guardianRelationship.findMany).toHaveBeenCalledWith({
      where: {
        guardeeId: 'guardee-1',
        status: GuardianRelationshipStatus.ACCEPTED,
      },
      select: {
        guardianId: true,
        guardee: { select: { email: true, phoneNumber: true } },
      },
    });
    expect(push.sendGuardianRiskNotification).toHaveBeenCalledWith(
      'guardian-1',
      'guardee-1',
      'guardee@example.com',
      RiskType.ACCIDENT,
      GuardianRiskNotificationTrigger.NEGATIVE_RESPONSE,
    );
    expect(prisma.guardianRiskNotification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        guardianId: 'guardian-1',
        guardeeId: 'guardee-1',
        riskType: RiskType.ACCIDENT,
        trigger: GuardianRiskNotificationTrigger.NEGATIVE_RESPONSE,
        responseEventId: 'event-1',
      }),
    });
  });

  it('does not redeliver an already-recorded negative response', async () => {
    prisma.guardianRiskNotification.findUnique.mockResolvedValue({
      id: 'sent',
    });

    await service.dispatchNegativeResponse({
      guardeeId: 'guardee-1',
      riskType: RiskType.ACCIDENT,
      responseEventId: 'event-1',
    });

    expect(push.sendGuardianRiskNotification).not.toHaveBeenCalled();
  });

  it('immediately notifies accepted guardians once per fall event', async () => {
    await service.dispatchFallDetected('guardee-1', 'fall-event-1');

    expect(push.sendGuardianRiskNotification).toHaveBeenCalledWith(
      'guardian-1',
      'guardee-1',
      'guardee@example.com',
      RiskType.ACCIDENT,
      GuardianRiskNotificationTrigger.FALL_DETECTED,
    );
    expect(prisma.guardianRiskNotification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        guardianId: 'guardian-1',
        guardeeId: 'guardee-1',
        riskType: RiskType.ACCIDENT,
        trigger: GuardianRiskNotificationTrigger.FALL_DETECTED,
        responseEventId: 'fall-event-1',
      }),
    });
  });

  it('sends timeout alerts for risks returned by the unanswered-check query', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        userId: 'guardee-1',
        riskType: RiskType.HIGH_RISK_AREA,
        riskLevel: RiskLevel.HIGH,
      } as UserRisk,
    ]);

    await service.dispatchTimeoutAlerts();

    expect(push.sendGuardianRiskNotification).toHaveBeenCalledWith(
      'guardian-1',
      'guardee-1',
      'guardee@example.com',
      RiskType.HIGH_RISK_AREA,
      GuardianRiskNotificationTrigger.LIVENESS_TIMEOUT,
    );
    expect(prisma.guardianRiskNotification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        trigger: GuardianRiskNotificationTrigger.LIVENESS_TIMEOUT,
        responseEventId: undefined,
      }),
    });
  });
});
