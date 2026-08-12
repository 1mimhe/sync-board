import { createHash } from 'crypto';

/**
 * Computes SHA-256 hash of a raw token string.
 * Used for secure token storage and database lookups.
 *
 * @param token - The raw token string to hash
 * @returns Hex-encoded SHA-256 hash string
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
