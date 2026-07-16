import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PushPlatform } from '@prisma/client';
import { FCM_TEST_SEND_ENABLED_ENV } from '../firebase/firebase.constants';
import {
  FirebaseMessagingGateway,
  PermanentPushInstallationError,
} from '../firebase/firebase-messaging.gateway';
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

  it('upserts by FID and transfers ownership while re-enabling it', async () => {
    const now = new Date('2026-07-16T18:00:00.000Z');
    jest.useFakeTimers({ now });
    const dto = {
      firebaseInstallationId: 'installation-id',
      platform: 'android' as const,
    };
    prisma.pushDevice.upsert.mockResolvedValue({ id: 'device-1' });

    await service.registerDevice('new-owner', dto);

    expect(prisma.pushDevice.upsert).toHaveBeenCalledWith({
      where: { firebaseInstallationId: 'installation-id' },
      create: {
        userId: 'new-owner',
        firebaseInstallationId: 'installation-id',
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
      service.removeDevice('user-1', 'other-users-installation'),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.pushDevice.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        firebaseInstallationId: 'other-users-installation',
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

  it('sends to every active Android device and disables invalid FIDs', async () => {
    prisma.pushDevice.findMany.mockResolvedValue([
      { id: 'device-1', firebaseInstallationId: 'fid-1' },
      { id: 'device-2', firebaseInstallationId: 'fid-2' },
      { id: 'device-3', firebaseInstallationId: 'fid-3' },
    ]);
    gateway.sendTestNotification
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new PermanentPushInstallationError())
      .mockRejectedValueOnce(new Error('temporary failure'));
    prisma.pushDevice.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.sendTestNotification('user-1')).resolves.toEqual({
      sent: 1,
      failed: 2,
      disabled: 1,
    });
    expect(gateway.sendTestNotification).toHaveBeenCalledTimes(3);
    expect(prisma.pushDevice.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['device-2'] }, userId: 'user-1' },
      data: { enabled: false },
    });
  });
});
