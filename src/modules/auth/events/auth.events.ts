/**
 * Event payload emitted when a user successfully registers.
 */
export class UserRegisteredEvent {
  userId!: string;
  email!: string;
  displayName?: string;
  verificationToken?: string;
}

/**
 * Event payload emitted when a user logs in.
 */
export class UserLoggedInEvent {
  userId!: string;
  method!: 'email' | 'google';
}

/**
 * Event payload emitted when a password reset is requested.
 */
export class PasswordResetRequestedEvent {
  userId!: string;
  email!: string;
  token!: string;
}

/**
 * Event payload emitted when an email verification link is (re)requested.
 */
export class EmailVerificationRequestedEvent {
  userId!: string;
  email!: string;
  token!: string;
}

/**
 * Event payload emitted when a user's email address is verified.
 */
export class EmailVerifiedEvent {
  userId!: string;
  email!: string;
  displayName?: string;
}
