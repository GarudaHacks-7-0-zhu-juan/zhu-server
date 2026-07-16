import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PushPlatform } from '@prisma/client';
import {
  envFlagEnabled,
  FCM_TEST_SEND_ENABLED_ENV,
} from '../firebase/firebase.constants';
import {
  FirebaseMessagingGateway,
  PermanentPushInstallationError,
} from '../firebase/firebase-messaging.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterPushDeviceDto } from './dto/register-push-device.dto';

@Injectable()
export class PushService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: FirebaseMessagingGateway,
    private readonly config: ConfigService,
  ) {}

  registerDevice(userId: string, dto: RegisterPushDeviceDto) {
    return this.prisma.pushDevice.upsert({
      where: { firebaseInstallationId: dto.firebaseInstallationId },
      create: {
        userId,
        firebaseInstallationId: dto.firebaseInstallationId,
        platform: PushPlatform.ANDROID,
      },
      update: {
        userId,
        platform: PushPlatform.ANDROID,
        enabled: true,
        lastSeenAt: new Date(),
      },
    });
  }

  async removeDevice(
    userId: string,
    firebaseInstallationId: string,
  ): Promise<{ disabled: true }> {
    const result = await this.prisma.pushDevice.updateMany({
      where: { userId, firebaseInstallationId, enabled: true },
      data: { enabled: false },
    });

    if (result.count === 0) {
      throw new NotFoundException('Push device not found');
    }

    return { disabled: true };
  }

  async sendTestNotification(userId: string): Promise<{
    sent: number;
    failed: number;
    disabled: number;
  }> {
    if (!envFlagEnabled(this.config.get<string>(FCM_TEST_SEND_ENABLED_ENV))) {
      throw new NotFoundException('Push test endpoint is disabled');
    }
    if (!this.gateway.isAvailable) {
      throw new ServiceUnavailableException(
        'Firebase messaging is unavailable',
      );
    }

    const devices = await this.prisma.pushDevice.findMany({
      where: { userId, enabled: true, platform: PushPlatform.ANDROID },
      select: { id: true, firebaseInstallationId: true },
    });
    if (devices.length === 0) {
      throw new NotFoundException('No active push devices found');
    }

    const results = await Promise.allSettled(
      devices.map((device) =>
        this.gateway.sendTestNotification(device.firebaseInstallationId),
      ),
    );
    const invalidPushIds = results.flatMap((result, index) =>
      result.status === 'rejected' &&
      result.reason instanceof PermanentPushInstallationError
        ? [devices[index].id]
        : [],
    );
    const disabled = invalidPushIds.length
      ? await this.prisma.pushDevice.updateMany({
          where: { id: { in: invalidPushIds }, userId },
          data: { enabled: false },
        })
      : { count: 0 };
    const sent = results.filter(
      (result) => result.status === 'fulfilled',
    ).length;

    return {
      sent,
      failed: results.length - sent,
      disabled: disabled.count,
    };
  }
}
