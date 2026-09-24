import type { RefreshToken, User } from '@prisma/client';

/** Refresh token row with its owner. */
export type RefreshTokenWithUser = RefreshToken & { user: User };
