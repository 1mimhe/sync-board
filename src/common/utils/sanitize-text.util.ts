/**
 * Strips ALL HTML/XML markup from user text (XSS defense-in-depth).
 * Tags are removed entirely; entities are decoded once.
 */
export function sanitizePlainText(value: string): string {
  return value
    .replace(/<[^>]*>/g, '') // strip tags
    .replace(/&lt;/g, '<') // decode common entities BEFORE final tag-strip
    .replace(/&gt;/g, '>')
    .replace(/<[^>]*>/g, '') // second pass catches decoded tags
    .trim();
}
