import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key used by {@link EmailVerifiedGuard} to identify endpoints that
 * unverified users may access despite not having verified their email.
 */
export const SKIP_EMAIL_VERIFICATION_KEY = 'skipEmailVerification';

/**
 * Marks an endpoint as accessible to users who have NOT verified their email.
 * Apply on top of `JwtAuthGuard` + `EmailVerifiedGuard` protected routes that
 * must stay usable pre-verification (self-service endpoints such as
 * resending the verification email or accepting a workspace invitation).
 */
export const SkipEmailVerification = () =>
  SetMetadata(SKIP_EMAIL_VERIFICATION_KEY, true);
