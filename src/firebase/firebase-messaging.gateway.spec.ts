import { Logger } from '@nestjs/common';
import { FirebaseMessagingError, Messaging } from 'firebase-admin/messaging';
import { FirebaseMessagingGateway } from './firebase-messaging.gateway';

describe('FirebaseMessagingGateway', () => {
  const messaging = { send: jest.fn() };
  const loggerError = jest
    .spyOn(Logger.prototype, 'error')
    .mockImplementation(() => undefined);
  const gateway = new FirebaseMessagingGateway(
    messaging as unknown as Messaging,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    loggerError.mockRestore();
  });

  it('maps a test notification to an Android token message', async () => {
    messaging.send.mockResolvedValue('message-id');

    await gateway.sendTestNotification('registration-token');

    expect(messaging.send).toHaveBeenCalledWith({
      token: 'registration-token',
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

  it('maps a liveness test to a high-priority data message', async () => {
    messaging.send.mockResolvedValue('message-id');

    await gateway.sendTestLivenessCheck('registration-token');

    expect(messaging.send).toHaveBeenCalledWith({
      token: 'registration-token',
      data: {
        eventType: 'LIVENESS_CHECK',
        riskType: 'HIGH_RISK_AREA',
        title: 'Are you safe?',
        body: 'Confirm that you are safe.',
      },
      android: { priority: 'high' },
    });
  });

  it.each(['registration-token-not-registered', 'invalid-recipient'])(
    'logs token error %s without its recipient',
    async (code) => {
      const error = new FirebaseMessagingError({
        code,
        message: 'Installation is invalid',
      });
      messaging.send.mockRejectedValue(error);

      await expect(gateway.sendTestNotification('secret-token')).rejects.toBe(
        error,
      );
      expect(loggerError).toHaveBeenCalledWith(
        `FCM send failed: messaging/${code}`,
      );
      expect(loggerError).not.toHaveBeenCalledWith(
        expect.stringContaining('secret-token'),
      );
    },
  );

  it('logs a generic invalid argument', async () => {
    messaging.send.mockRejectedValue(
      new FirebaseMessagingError({
        code: 'invalid-argument',
        message: 'Message payload is invalid',
      }),
    );

    await expect(
      gateway.sendTestNotification('registration-token'),
    ).rejects.toMatchObject({ code: 'messaging/invalid-argument' });
    expect(loggerError).toHaveBeenCalledWith(
      'FCM send failed: messaging/invalid-argument',
    );
    expect(loggerError).not.toHaveBeenCalledWith(
      expect.stringContaining('registration-token'),
    );
  });
});
