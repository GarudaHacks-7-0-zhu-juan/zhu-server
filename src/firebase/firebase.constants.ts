export const FIREBASE_MESSAGING = Symbol('FIREBASE_MESSAGING');
export const FCM_ENABLED_ENV = 'FCM_ENABLED';
export const FCM_TEST_SEND_ENABLED_ENV = 'FCM_TEST_SEND_ENABLED';
export const FIREBASE_PROJECT_ID_ENV = 'FIREBASE_PROJECT_ID';

export function envFlagEnabled(value: string | undefined): boolean {
  return (
    value !== undefined && ['true', '1', 'yes'].includes(value.toLowerCase())
  );
}
