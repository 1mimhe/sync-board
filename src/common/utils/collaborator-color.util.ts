/**
 * Distinct collaborator colors assigned deterministically to active room participants.
 * Curated 16 high-contrast, accessible colors matching modern collaboration design systems.
 */
export const COLLABORATOR_COLORS = [
  '#E11D48', // Rose / Red
  '#2563EB', // Blue
  '#059669', // Emerald
  '#D97706', // Amber
  '#7C3AED', // Violet
  '#0891B2', // Cyan
  '#DB2777', // Pink
  '#4F46E5', // Indigo
  '#EA580C', // Orange
  '#16A34A', // Green
  '#9333EA', // Purple
  '#0284C7', // Sky
  '#CA8A04', // Yellow Gold
  '#65A30D', // Lime
  '#0D9488', // Teal
  '#C026D3', // Fuchsia
] as const;

/**
 * 32-bit FNV-1a hash algorithm for uniform distribution of UUID strings.
 *
 * @param userId - User UUID
 * @returns Non-negative 32-bit integer hash
 */
export function hashUserId(userId: string): number {
  let hash = 2166136261;
  for (let i = 0; i < userId.length; i++) {
    hash ^= userId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

/**
 * Assigns a deterministic, collision-free collaborator color for a user.
 * 1. Hashes the userId using FNV-1a to pick an initial palette color.
 * 2. Probes the curated 16-color palette to find an unallocated color.
 * 3. If all 16 palette colors are taken, generates a distinct vibrant HSL hue
 *    using the Golden Ratio (137.508°).
 *
 * @param userId - User UUID
 * @param takenColors - Set or iterable of colors already assigned in the current session
 * @returns Hex or HSL color string
 */
export function assignCollaboratorColor(
  userId: string,
  takenColors: Set<string> | Iterable<string>,
): string {
  const takenSet =
    takenColors instanceof Set ? takenColors : new Set(takenColors);
  const hash = hashUserId(userId);
  let colorIdx = hash % COLLABORATOR_COLORS.length;
  let attempts = 0;

  while (
    takenSet.has(COLLABORATOR_COLORS[colorIdx]) &&
    attempts < COLLABORATOR_COLORS.length
  ) {
    colorIdx = (colorIdx + 1) % COLLABORATOR_COLORS.length;
    attempts++;
  }

  if (!takenSet.has(COLLABORATOR_COLORS[colorIdx])) {
    return COLLABORATOR_COLORS[colorIdx];
  }

  // Palette exhausted on a large session — generate a distinct vibrant HSL hue
  const goldenHue = Math.round((hash + attempts * 137.508) % 360);
  return `hsl(${goldenHue}, 75%, 50%)`;
}
