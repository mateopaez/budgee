/**
 * Maps Firebase Auth error codes to messages a person can act on.
 * Raw codes are never shown in the UI.
 */
const MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'That email address does not look right.',
  'auth/missing-email': 'Enter your email address first.',
  'auth/user-disabled': 'This account has been disabled. Contact support to reopen it.',
  'auth/user-not-found': 'We could not find an account with that email.',
  'auth/wrong-password': 'That email and password combination did not match.',
  'auth/invalid-credential': 'That email and password combination did not match.',
  'auth/invalid-login-credentials': 'That email and password combination did not match.',
  'auth/email-already-in-use': 'An account already exists with that email. Try signing in.',
  'auth/weak-password': 'Choose a password with at least 8 characters.',
  'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
  'auth/network-request-failed': 'No connection. Check your network and try again.',
  'auth/operation-not-allowed':
    'This sign in method is not enabled for the project yet. Enable it in the Firebase console.',
  'auth/unauthorized-domain': 'This domain is not authorised for sign in in the Firebase console.',
  'auth/requires-recent-login': 'For security, sign in again before making this change.',
};

const FALLBACK = 'Something went wrong. Try again in a moment.';

function readCode(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code: unknown }).code;
    return typeof code === 'string' ? code : null;
  }
  return null;
}

export function friendlyAuthError(error: unknown): string {
  const code = readCode(error);
  if (code && MESSAGES[code]) return MESSAGES[code];
  return FALLBACK;
}
