import { ConfigService } from '@nestjs/config';
import { FCM_ENABLED_ENV, FIREBASE_PROJECT_ID_ENV } from './firebase.constants';
import { createFirebaseMessaging } from './firebase.module';

describe('createFirebaseMessaging', () => {
  it('does not require Firebase configuration when FCM is disabled', () => {
    const config = {
      get: jest.fn().mockReturnValue(undefined),
    };

    expect(
      createFirebaseMessaging(config as unknown as ConfigService),
    ).toBeNull();
    expect(config.get).toHaveBeenCalledWith(FCM_ENABLED_ENV);
  });

  it('requires a project id when FCM is enabled', () => {
    const config = {
      get: jest
        .fn()
        .mockImplementation((key: string) =>
          key === FCM_ENABLED_ENV ? 'true' : undefined,
        ),
    };

    expect(() =>
      createFirebaseMessaging(config as unknown as ConfigService),
    ).toThrow(
      `${FIREBASE_PROJECT_ID_ENV} is required when ${FCM_ENABLED_ENV} is enabled`,
    );
  });
});
