/**
 * Event payload emitted when a user successfully registers.
 */
export class UserRegisteredEvent {
  userId!: string;
  email!: string;
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
