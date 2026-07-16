import { Request } from 'express';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { PushController } from './push.controller';
import { PushService } from './push.service';

type AuthenticatedRequest = Request & { user: JwtPayload };

describe('PushController', () => {
  const push = {
    registerDevice: jest.fn(),
    removeDevice: jest.fn(),
    sendTestNotification: jest.fn(),
  };
  const controller = new PushController(push as unknown as PushService);
  const request = {
    user: { sub: 'user-1', email: 'user@example.com' },
  } as unknown as AuthenticatedRequest;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('scopes device registration to the authenticated user', async () => {
    const dto = {
      registrationToken: 'registration-token',
      platform: 'android' as const,
    };
    push.registerDevice.mockResolvedValue({ id: 'device-1' });

    await controller.registerDevice(request, dto);

    expect(push.registerDevice).toHaveBeenCalledWith('user-1', dto);
  });

  it('scopes device removal to the authenticated user', async () => {
    push.removeDevice.mockResolvedValue({ disabled: true });

    await controller.removeDevice(request, 'registration-token');

    expect(push.removeDevice).toHaveBeenCalledWith(
      'user-1',
      'registration-token',
    );
  });

  it('scopes test sends to the authenticated user', async () => {
    push.sendTestNotification.mockResolvedValue({
      sent: 1,
      failed: 0,
      disabled: 0,
    });

    await controller.sendTestNotification(request);

    expect(push.sendTestNotification).toHaveBeenCalledWith('user-1');
  });
});
