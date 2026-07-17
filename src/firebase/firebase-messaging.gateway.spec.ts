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
        title: 'High-risk area check-in',
        body: "You're in an area with elevated risk. Are you safe?",
      },
      android: { priority: 'high' },
    });
  });

  it('maps a production liveness check to a data-only high-priority message', async () => {
    messaging.send.mockResolvedValue('message-id');

    await gateway.sendLivenessCheck('registration-token', 'DISASTER');

    expect(messaging.send).toHaveBeenCalledWith({
      token: 'registration-token',
      data: {
        eventType: 'LIVENESS_CHECK',
        riskType: 'DISASTER',
        title: 'Disaster safety check',
        body: "A disaster may be affecting your area. Confirm that you're safe.",
      },
      android: {
        priority: 'high',
      },
    });
  });

  it('maps a fall check to a data-only high-priority message', async () => {
    messaging.send.mockResolvedValue('message-id');

    await gateway.sendLivenessCheck('registration-token', 'ACCIDENT');

    expect(messaging.send).toHaveBeenCalledWith({
      token: 'registration-token',
      data: {
        eventType: 'LIVENESS_CHECK',
        riskType: 'ACCIDENT',
        title: 'Fall detected',
        body: 'We detected a fall. Are you safe?',
      },
      android: { priority: 'high' },
    });
  });

  it('maps a guardian risk notification to an Android token message', async () => {
    messaging.send.mockResolvedValue('message-id');

    await gateway.sendGuardianRiskNotification(
      'registration-token',
      'DISASTER',
      'NEGATIVE_RESPONSE',
      'notification-1',
      'guardee-1',
      'Ada',
    );

    expect(messaging.send).toHaveBeenCalledWith({
      token: 'registration-token',
      notification: {
        title: 'Guardee safety alert',
        body: 'A guardee may need your attention.',
      },
      data: {
        eventType: 'GUARDIAN_RISK_ALERT',
        notificationId: 'notification-1',
        guardeeId: 'guardee-1',
        guardeeDisplayName: 'Ada',
        route: '/guardees/guardee-1',
        riskType: 'DISASTER',
        trigger: 'NEGATIVE_RESPONSE',
      },
      android: {
        priority: 'high',
        notification: { channelId: 'high_importance_channel' },
      },
    });
  });

  it('maps a fall alert for guardians', async () => {
    messaging.send.mockResolvedValue('message-id');

    await gateway.sendGuardianRiskNotification(
      'registration-token',
      'ACCIDENT',
      'FALL_DETECTED',
      'notification-2',
      'guardee-1',
    );

    expect(messaging.send).toHaveBeenCalledWith({
      token: 'registration-token',
      notification: {
        title: 'Fall detected',
        body: 'Your guardee may need assistance after a fall.',
      },
      data: {
        eventType: 'GUARDIAN_RISK_ALERT',
        notificationId: 'notification-2',
        guardeeId: 'guardee-1',
        route: '/guardees/guardee-1',
        riskType: 'ACCIDENT',
        trigger: 'FALL_DETECTED',
      },
      android: {
        priority: 'high',
        notification: { channelId: 'high_importance_channel' },
      },
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
