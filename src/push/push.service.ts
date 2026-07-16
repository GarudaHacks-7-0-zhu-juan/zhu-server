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
import { FirebaseMessagingGateway } from '../firebase/firebase-messaging.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterPushDeviceDto } from './dto/register-push-device.dto';

@Injectable()
export class PushService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: FirebaseMessagingGateway,
    private readonly config: ConfigService,
  ) {}

  async registerDevice(userId: string, dto: RegisterPushDeviceDto) {
    await this.prisma.pushDevice.updateMany({
      where: {
        userId,
        registrationToken: { not: dto.registrationToken },
        enabled: true,
      },
      data: { enabled: false },
    });

    return this.prisma.pushDevice.upsert({
      where: { registrationToken: dto.registrationToken },
      create: {
        userId,
        registrationToken: dto.registrationToken,
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
    registrationToken: string,
  ): Promise<{ disabled: true }> {
    const result = await this.prisma.pushDevice.updateMany({
      where: { userId, registrationToken, enabled: true },
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
    return this.sendTest(userId, (registrationToken) =>
      this.gateway.sendTestNotification(registrationToken),
    );
  }

  async sendTestLivenessCheck(userId: string): Promise<{
    sent: number;
    failed: number;
    disabled: number;
  }> {
    return this.sendTest(userId, (registrationToken) =>
      this.gateway.sendTestLivenessCheck(registrationToken),
    );
  }

  private async sendTest(
    userId: string,
    send: (registrationToken: string) => Promise<void>,
  ): Promise<{ sent: number; failed: number; disabled: number }> {
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
      select: { registrationToken: true },
    });
    if (devices.length === 0) {
      throw new NotFoundException('No active push devices found');
    }

    const results = await Promise.allSettled(
      devices.map((device) => send(device.registrationToken)),
    );
    const sent = results.filter(
      (result) => result.status === 'fulfilled',
    ).length;

    return {
      sent,
      failed: results.length - sent,
      disabled: 0,
    };
  }
}
