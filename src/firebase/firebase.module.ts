import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, Messaging } from 'firebase-admin/messaging';
import {
  envFlagEnabled,
  FCM_ENABLED_ENV,
  FIREBASE_MESSAGING,
  FIREBASE_PROJECT_ID_ENV,
} from './firebase.constants';
import { FirebaseMessagingGateway } from './firebase-messaging.gateway';

export function createFirebaseMessaging(
  config: ConfigService,
): Messaging | null {
  if (!envFlagEnabled(config.get<string>(FCM_ENABLED_ENV))) {
    return null;
  }

  const projectId = config.get<string>(FIREBASE_PROJECT_ID_ENV)?.trim();
  if (!projectId) {
    throw new Error(
      `${FIREBASE_PROJECT_ID_ENV} is required when ${FCM_ENABLED_ENV} is enabled`,
    );
  }
  const app =
    getApps().find((candidate) => candidate.name === '[DEFAULT]') ??
    initializeApp({ credential: applicationDefault(), projectId });

  return getMessaging(app);
}

@Module({
  providers: [
    {
      provide: FIREBASE_MESSAGING,
      inject: [ConfigService],
      useFactory: createFirebaseMessaging,
    },
    FirebaseMessagingGateway,
  ],
  exports: [FirebaseMessagingGateway],
})
export class FirebaseModule {}
