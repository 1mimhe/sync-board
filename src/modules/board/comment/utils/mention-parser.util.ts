const MENTION_RE = /@([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/gi;

/** Extracts unique lowercase @email mentions from comment text. */
export function parseMentionedEmails(content: string): string[] {
  const found = new Set<string>();
  for (const m of content.matchAll(MENTION_RE)) {
    found.add(m[1].toLowerCase());
  }
  return [...found];
}
