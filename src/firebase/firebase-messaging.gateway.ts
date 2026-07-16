import { Inject, Injectable } from '@nestjs/common';
import {
  FirebaseMessagingError,
  Message,
  Messaging,
} from 'firebase-admin/messaging';
import { FIREBASE_MESSAGING } from './firebase.constants';

export class PermanentPushInstallationError extends Error {}

@Injectable()
export class FirebaseMessagingGateway {
  constructor(
    @Inject(FIREBASE_MESSAGING)
    private readonly messaging: Messaging | null,
  ) {}

  get isAvailable(): boolean {
    return this.messaging !== null;
  }

  async sendTestNotification(firebaseInstallationId: string): Promise<void> {
    if (!this.messaging) {
      throw new Error('Firebase messaging is unavailable');
    }

    const message: Message = {
      fid: firebaseInstallationId,
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
      if (
        error instanceof FirebaseMessagingError &&
        [
          'messaging/installation-id-not-registered',
          'messaging/invalid-recipient',
        ].includes(error.code)
      ) {
        throw new PermanentPushInstallationError();
      }
      throw error;
    }
  }
}
