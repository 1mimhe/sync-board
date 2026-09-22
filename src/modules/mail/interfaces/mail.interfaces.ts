/**
 * Payload carried on `email.exchange` for queued transactional email.
 */
export interface EmailSendPayload {
  template: string;
  to: string;
  subject: string;
  data: Record<string, unknown>;
}
