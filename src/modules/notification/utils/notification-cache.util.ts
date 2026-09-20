/**
 * Utility functions for notification caching and Redis key generation.
 */

/**
 * Returns the Redis key for tracking a user's unread notification counter.
 *
 * @param userId - Target user UUID
 * @returns Formatted Redis key string
 */
export function unreadCountKey(userId: string): string {
  return `notifications:unread:${userId}`;
}
