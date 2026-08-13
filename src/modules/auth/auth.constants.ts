/**
 * Authentication module configuration constants.
 */
export const AUTH_CONFIG = {
  accessToken: {
    algorithm: 'RS256' as const,
    expiresIn: '15m',
    issuer: 'syncboard',
  },
  refreshToken: {
    expiresInDays: 7,
    familyMaxSize: 50,
  },
  password: {
    bcryptRounds: 12,
    minLength: 8,
    maxLength: 128,
  },
  rateLimit: {
    loginAttempts: 5,
    registerAttempts: 3,
    refreshAttempts: 10,
    passwordResetAttempts: 3,
  },
} as const;

export const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';

/**
 * Throttling threshold configurations for authentication controller endpoints.
 */
export const AUTH_THROTTLE_CONFIG = {
  register: {
    default: {
      limit: AUTH_CONFIG.rateLimit.registerAttempts,
      ttl: 60_000,
    },
  },
  login: {
    default: {
      limit: AUTH_CONFIG.rateLimit.loginAttempts,
      ttl: 60_000,
    },
  },
  refresh: {
    default: {
      limit: AUTH_CONFIG.rateLimit.refreshAttempts,
      ttl: 60_000,
    },
  },
  forgotPassword: {
    default: {
      limit: AUTH_CONFIG.rateLimit.passwordResetAttempts,
      ttl: 3_600_000,
    },
  },
  resetPassword: {
    default: {
      limit: AUTH_CONFIG.rateLimit.passwordResetAttempts,
      ttl: 3_600_000,
    },
  },
} as const;

export const getRefreshTokenCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/api/auth',
  maxAge: AUTH_CONFIG.refreshToken.expiresInDays * 24 * 60 * 60 * 1000,
});

