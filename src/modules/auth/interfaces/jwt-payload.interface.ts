/**
 * Decoded payload contained in JWT access tokens.
 */
export interface JwtPayload {
  /** User unique identifier (UUID) */
  sub: string;
  /** User email address */
  email: string;
  /** User display name */
  displayName: string;
  /** User avatar image URL (optional) */
  avatarUrl?: string | null;
  /** Whether the user has verified their email address */
  isEmailVerified: boolean;
  /** Token issue timestamp (seconds since epoch) */
  iat: number;
  /** Token expiration timestamp (seconds since epoch) */
  exp: number;
  /** Token issuer ('syncboard') */
  iss: string;
  /** Unique token identifier for blacklisting / revocation */
  jti: string;
}
