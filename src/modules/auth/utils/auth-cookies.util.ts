import { AUTH_CONFIG } from '../auth.constants';

/** Builds cookie options for the refresh-token HTTP-only cookie. */
export const getRefreshTokenCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/api/auth',
  maxAge: AUTH_CONFIG.refreshToken.expiresInDays * 24 * 60 * 60 * 1000,
});
