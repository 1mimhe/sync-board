/**
 * Central registry of auth-domain internal event names.
 * Consumers MUST import from here — never inline these strings.
 */
export const AUTH_EVENTS = {
  registered: 'user.registered',
  loggedIn: 'user.logged_in',
  passwordResetRequested: 'user.password_reset_requested',
  emailVerificationRequested: 'user.email_verification_requested',
  emailVerified: 'user.email_verified',
} as const;
