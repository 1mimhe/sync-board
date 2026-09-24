/** Shared validation helpers. */

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Shared UUID-v4 pattern (use when a regex is required). */
export const UUID_V4_PATTERN = UUID_V4_RE;

/**
 * Checks whether a value is a UUID-v4 string.
 *
 * @param value - Candidate value
 * @returns True when the value matches UUID-v4 format
 */
export function isUuidV4(value: unknown): value is string {
  return typeof value === 'string' && UUID_V4_RE.test(value);
}
