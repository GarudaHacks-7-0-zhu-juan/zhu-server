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
        title:
          trigger === 'FALL_DETECTED'
            ? 'Fall detected'
            : 'Guardee safety alert',
        body:
          trigger === 'FALL_DETECTED'
            ? 'Your guardee may need assistance after a fall.'
            : 'A guardee may need your attention.',
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
        ...this.livenessCopy('HIGH_RISK_AREA'),
      },
      android: { priority: 'high' },
    });
  }

  async sendLivenessCheck(
    registrationToken: string,
    riskType: string,
  ): Promise<void> {
    await this.send({
      token: registrationToken,
      data: {
        eventType: 'LIVENESS_CHECK',
        riskType,
        ...this.livenessCopy(riskType),
      },
      android: { priority: 'high' },
    });
  }

  private livenessCopy(riskType: string): { title: string; body: string } {
    switch (riskType) {
      case 'HIGH_RISK_AREA':
        return {
          title: 'High-risk area check-in',
          body: "You're in an area with elevated risk. Are you safe?",
        };
      case 'DISASTER':
        return {
          title: 'Disaster safety check',
          body: "A disaster may be affecting your area. Confirm that you're safe.",
        };
      case 'ACCIDENT':
        return {
          title: 'Fall detected',
          body: 'We detected a fall. Are you safe?',
        };
      default:
        return {
          title: 'Are you safe?',
          body: 'Confirm that you are safe.',
        };
    }
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
