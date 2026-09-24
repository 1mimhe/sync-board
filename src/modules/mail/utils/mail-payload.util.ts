import type { EmailSendPayload } from '../interfaces/mail.interfaces';

/**
 * Rejects malformed email payloads before sending.
 *
 * @param payload - Incoming email payload
 * @returns True when the payload carries template, recipient, and data
 */
export function isValidEmailPayload(
  payload: EmailSendPayload | undefined,
): payload is EmailSendPayload {
  return (
    !!payload &&
    typeof payload.template === 'string' &&
    payload.template.length > 0 &&
    typeof payload.to === 'string' &&
    payload.to.length > 0 &&
    typeof payload.subject === 'string' &&
    payload.subject.length > 0 &&
    typeof payload.data === 'object' &&
    payload.data !== null
  );
}
