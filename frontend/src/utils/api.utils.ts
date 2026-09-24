/** Raw backend payload shape before normalization to `ApiResponse`. */
export type BackendEnvelope<T> = {
  data?: T
  accessToken?: string
  error?: { code?: string; message?: string | string[] } & Record<string, unknown>
  message?: string | string[]
  code?: string
} & Record<string, unknown>

/**
 * Extracts a display message from a raw backend envelope.
 *
 * @param raw - Raw envelope or null when the body was empty
 * @param fallback - Message used when the envelope carries none
 * @returns Joined message string or the fallback
 */

export function getEnvelopeMessage(raw: BackendEnvelope<unknown> | null, fallback: string): string {
  const rawMsg = raw?.error && typeof raw.error === 'object' && 'message' in raw.error
    ? (raw.error as { message?: unknown }).message
    : raw?.message
  if (Array.isArray(rawMsg)) return rawMsg.join(', ')
  if (typeof rawMsg === 'string') return rawMsg
  return fallback
}
