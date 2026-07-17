import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GuardianRiskNotificationTrigger,
  PushPlatform,
  RiskType,
} from '@prisma/client';
import { FCM_TEST_SEND_ENABLED_ENV } from '../firebase/firebase.constants';
import { FirebaseMessagingGateway } from '../firebase/firebase-messaging.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from './push.service';

describe('PushService', () => {
  const prisma = {
    pushDevice: {
      upsert: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
  };
  const gateway = {
    isAvailable: true,
    sendTestNotification: jest.fn(),
    sendTestLivenessCheck: jest.fn(),
    sendLivenessCheck: jest.fn(),
    sendGuardianRiskNotification: jest.fn(),
  };
  const config = { get: jest.fn() };
  const service = new PushService(
    prisma as unknown as PrismaService,
    gateway as unknown as FirebaseMessagingGateway,
    config as unknown as ConfigService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    gateway.isAvailable = true;
    config.get.mockImplementation((key: string) =>
      key === FCM_TEST_SEND_ENABLED_ENV ? 'true' : undefined,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps only the latest token active while upserting ownership', async () => {
    const now = new Date('2026-07-16T18:00:00.000Z');
    jest.useFakeTimers({ now });
    const dto = {
      registrationToken: 'registration-token',
      platform: 'android' as const,
    };
    prisma.pushDevice.updateMany.mockResolvedValue({ count: 2 });
    prisma.pushDevice.upsert.mockResolvedValue({ id: 'device-1' });

    await service.registerDevice('new-owner', dto);

    expect(prisma.pushDevice.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'new-owner',
        registrationToken: { not: 'registration-token' },
        enabled: true,
      },
      data: { enabled: false },
    });
    expect(prisma.pushDevice.upsert).toHaveBeenCalledWith({
      where: { registrationToken: 'registration-token' },
      create: {
        userId: 'new-owner',
        registrationToken: 'registration-token',
        platform: PushPlatform.ANDROID,
      },
      update: {
        userId: 'new-owner',
        platform: PushPlatform.ANDROID,
        enabled: true,
        lastSeenAt: now,
      },
    });
  });

  it('only disables a device owned by the current user', async () => {
    prisma.pushDevice.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.removeDevice('user-1', 'other-users-token'),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.pushDevice.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        registrationToken: 'other-users-token',
        enabled: true,
      },
      data: { enabled: false },
    });
  });

  it('hides the test endpoint when test sends are disabled', async () => {
    config.get.mockReturnValue('false');

    await expect(service.sendTestNotification('user-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.pushDevice.findMany).not.toHaveBeenCalled();
  });

  it('returns service unavailable when Firebase is disabled', async () => {
    gateway.isAvailable = false;

    await expect(service.sendTestNotification('user-1')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('sends to every active Android device without disabling failures', async () => {
    prisma.pushDevice.findMany.mockResolvedValue([
      { registrationToken: 'token-1' },
      { registrationToken: 'token-2' },
      { registrationToken: 'token-3' },
    ]);
    gateway.sendTestNotification
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('invalid installation'))
      .mockRejectedValueOnce(new Error('temporary failure'));

    await expect(service.sendTestNotification('user-1')).resolves.toEqual({
      sent: 1,
      failed: 2,
      disabled: 0,
    });
    expect(gateway.sendTestNotification).toHaveBeenCalledTimes(3);
    expect(prisma.pushDevice.updateMany).not.toHaveBeenCalled();
  });

  it('sends a liveness check to the active Android device', async () => {
    prisma.pushDevice.findMany.mockResolvedValue([
      { registrationToken: 'token-1' },
    ]);
    gateway.sendTestLivenessCheck.mockResolvedValue(undefined);

    await expect(service.sendTestLivenessCheck('user-1')).resolves.toEqual({
      sent: 1,
      failed: 0,
      disabled: 0,
    });
    expect(gateway.sendTestLivenessCheck).toHaveBeenCalledWith('token-1');
  });

  it('sends production liveness checks to active Android devices', async () => {
    prisma.pushDevice.findMany.mockResolvedValue([
      { registrationToken: 'token-1' },
      { registrationToken: 'token-2' },
    ]);
    gateway.sendLivenessCheck
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('temporary failure'));

    await expect(
      service.sendLivenessCheck('user-1', RiskType.DISASTER),
    ).resolves.toEqual({ sent: 1, failed: 1 });
    expect(gateway.sendLivenessCheck).toHaveBeenNthCalledWith(
      1,
      'token-1',
      RiskType.DISASTER,
    );
  });

  it('fans guardian risk notifications out to active Android devices', async () => {
    prisma.pushDevice.findMany.mockResolvedValue([
      { registrationToken: 'token-1' },
      { registrationToken: 'token-2' },
    ]);
    gateway.sendGuardianRiskNotification
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('temporary failure'));

    await expect(
      service.sendGuardianRiskNotification(
        'guardian-1',
        'guardee-1',
        'guardee@example.com',
        RiskType.DISASTER,
        GuardianRiskNotificationTrigger.NEGATIVE_RESPONSE,
      ),
    ).resolves.toEqual({ sent: 1, failed: 1 });
    expect(gateway.sendGuardianRiskNotification).toHaveBeenNthCalledWith(
      1,
      'token-1',
      'guardee-1',
      'guardee@example.com',
      RiskType.DISASTER,
      GuardianRiskNotificationTrigger.NEGATIVE_RESPONSE,
    );
  });
});
