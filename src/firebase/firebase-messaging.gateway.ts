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
    if (!this.messaging) {
      throw new Error('Firebase messaging is unavailable');
    }

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

    try {
      await this.messaging.send(message);
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
