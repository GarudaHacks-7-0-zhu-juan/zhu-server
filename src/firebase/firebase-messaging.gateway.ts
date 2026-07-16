import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  FirebaseMessagingError,
  Message,
  Messaging,
} from 'firebase-admin/messaging';
import { FIREBASE_MESSAGING } from './firebase.constants';

@Injectable()
export class FirebaseMessagingGateway {
  private readonly logger = new Logger(FirebaseMessagingGateway.name);

  constructor(
    @Inject(FIREBASE_MESSAGING)
    private readonly messaging: Messaging | null,
  ) {}

  get isAvailable(): boolean {
    return this.messaging !== null;
  }

  async sendTestNotification(registrationToken: string): Promise<void> {
    const message: Message = {
      token: registrationToken,
      notification: {
        title: 'Zhu test notification',
        body: 'Push notifications are working.',
      },
      data: {
        eventType: 'TEST_NOTIFICATION',
        route: '/workspace',
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'high_importance_channel',
        },
      },
    };

    await this.send(message);
  }

  async sendGuardianRiskNotification(
    registrationToken: string,
    riskType: string,
    trigger: string,
  ): Promise<void> {
    await this.send({
      token: registrationToken,
      notification: {
        title: 'Guardee safety alert',
        body: 'A guardee may need your attention.',
      },
      data: {
        eventType: 'GUARDIAN_RISK_ALERT',
        route: '/guardees',
        riskType,
        trigger,
      },
      android: {
        priority: 'high',
        notification: { channelId: 'high_importance_channel' },
      },
    });
  }

  async sendTestLivenessCheck(registrationToken: string): Promise<void> {
    await this.send({
      token: registrationToken,
      data: {
        eventType: 'LIVENESS_CHECK',
        riskType: 'HIGH_RISK_AREA',
        title: 'Are you safe?',
        body: 'Confirm that you are safe.',
      },
      android: { priority: 'high' },
    });
  }

  private async send(message: Message): Promise<void> {
    const messaging = this.messaging;
    if (!messaging) {
      throw new Error('Firebase messaging is unavailable');
    }
    try {
      await messaging.send(message);
    } catch (error) {
      const errorCode =
        error instanceof FirebaseMessagingError
          ? error.code
          : error instanceof Error
            ? error.name
            : 'unknown';
      this.logger.error(`FCM send failed: ${errorCode}`);
      throw error;
    }
  }
}
