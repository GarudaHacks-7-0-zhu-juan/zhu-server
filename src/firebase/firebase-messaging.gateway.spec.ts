import { FirebaseMessagingError, Messaging } from 'firebase-admin/messaging';
import {
  FirebaseMessagingGateway,
  PermanentPushInstallationError,
} from './firebase-messaging.gateway';

describe('FirebaseMessagingGateway', () => {
  const messaging = { send: jest.fn() };
  const gateway = new FirebaseMessagingGateway(
    messaging as unknown as Messaging,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps a test notification to an Android FID message', async () => {
    messaging.send.mockResolvedValue('message-id');

    await gateway.sendTestNotification('installation-id');

    expect(messaging.send).toHaveBeenCalledWith({
      fid: 'installation-id',
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
        notification: { channelId: 'high_importance_channel' },
      },
    });
  });

  it.each(['installation-id-not-registered', 'invalid-recipient'])(
    'maps permanent FID error %s',
    async (code) => {
      messaging.send.mockRejectedValue(
        new FirebaseMessagingError({
          code,
          message: 'Installation is invalid',
        }),
      );

      await expect(
        gateway.sendTestNotification('installation-id'),
      ).rejects.toThrow(PermanentPushInstallationError);
    },
  );

  it('does not disable an installation for a generic invalid argument', async () => {
    messaging.send.mockRejectedValue(
      new FirebaseMessagingError({
        code: 'invalid-argument',
        message: 'Message payload is invalid',
      }),
    );

    await expect(
      gateway.sendTestNotification('installation-id'),
    ).rejects.toMatchObject({ code: 'messaging/invalid-argument' });
  });
});
