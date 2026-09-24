export const SOCKET_CONFIG = {
  reconnectionAttempts: 8,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
} as const

export const AUTH_ERROR_CODES = [
  'TOKEN_EXPIRED',
  'TOKEN_INVALID',
  'TOKEN_REVOKED',
  'UNAUTHORIZED',
] as const
