/**
 * MailHog API helpers — the black-box way to obtain single-use email tokens
 * (verification, invitation, password reset) during e2e runs.
 * Requires the compose stack (`docker compose up -d`) with mailhog on :8025.
 */

const MAILHOG_URL = process.env.MAILHOG_URL ?? 'http://localhost:8025';
const POLL_INTERVAL_MS = 300;
const DEFAULT_TIMEOUT_MS = 10_000;

interface MailhogRecipient {
  Mailbox: string;
  Domain: string;
}

interface MailhogItem {
  ID: string;
  From: MailhogRecipient;
  To: MailhogRecipient[];
  Content: { Headers: Record<string, string[]>; Body: string };
  Created: string;
}

interface MailhogListResponse {
  total: number;
  items: MailhogItem[];
}

async function listMessages(limit = 100): Promise<MailhogItem[]> {
  const res = await fetch(`${MAILHOG_URL}/api/v2/messages?limit=${limit}`);
  if (!res.ok) {
    throw new Error(`MailHog API unavailable (${res.status}) — is compose up?`);
  }
  const body = (await res.json()) as MailhogListResponse;
  return body.items ?? [];
}

export async function purgeMailbox(): Promise<void> {
  await fetch(`${MAILHOG_URL}/api/v1/messages`, { method: 'DELETE' });
}

function messageMatches(item: MailhogItem, email: string): boolean {
  const [localPart, domain] = email.toLowerCase().split('@');
  return item.To.some(
    (r) =>
      r.Mailbox.toLowerCase() === localPart &&
      r.Domain.toLowerCase() === domain,
  );
}

export type MailTokenKind = 'verify' | 'invite' | 'reset';

const TOKEN_PATTERNS: Record<MailTokenKind, RegExp> = {
  verify: /verify-email\?token=([A-Za-z0-9_-]+)/,
  invite: /invitations\/([0-9a-f]{64})\/accept/,
  reset: /reset-password\?token=([A-Za-z0-9_-]+)/,
};

/**
 * MailHog stores bodies with the transfer encoding applied (quoted-printable):
 * `=` is escaped as `=3D` and soft line breaks appear as `=\r\n`. Decode both
 * before token matching, otherwise base64url tokens are split/truncated
 * mid-sequence and verification (GETDEL single-use) rejects the remainder.
 */
function decodeQuotedPrintable(body: string): string {
  return body
    .replace(/=\r\n/g, '')
    .replace(/=([0-9A-Fa-f]{2})/g, (_m, hex: string) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
}

/** Extract every searchable text of a MailHog item, QP-decoded. */
function itemSearchText(item: MailhogItem): string {
  const parts = [item.Content?.Body ?? ''];
  return parts.map(decodeQuotedPrintable).join('\n');
}

/**
 * Poll MailHog until a message to `email` contains the expected token/URL,
 * then return the captured token. Throws on timeout.
 */
export async function waitForMailToken(
  email: string,
  kind: MailTokenKind,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  const pattern = TOKEN_PATTERNS[kind];
  while (Date.now() < deadline) {
    const items = await listMessages();
    for (const item of items) {
      if (!messageMatches(item, email)) continue;
      const match = pattern.exec(itemSearchText(item));
      if (match) return match[1];
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(
    `MailHog: no "${kind}" email with token found for ${email} within ${timeoutMs}ms`,
  );
}
