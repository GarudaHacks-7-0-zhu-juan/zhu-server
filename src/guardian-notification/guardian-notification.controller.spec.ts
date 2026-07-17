import { GuardianNotificationController } from './guardian-notification.controller';
import { GuardianNotificationService } from './guardian-notification.service';

describe('GuardianNotificationController', () => {
  it('lists notifications for the authenticated guardian', () => {
    const notifications = { listForGuardian: jest.fn() };
    const controller = new GuardianNotificationController(
      notifications as unknown as GuardianNotificationService,
    );

    controller.list({ user: { sub: 'guardian-1' } } as never, {
      cursor: 'notification-1',
      limit: 10,
    });

    expect(notifications.listForGuardian).toHaveBeenCalledWith(
      'guardian-1',
      'notification-1',
      10,
    );
  });
});
