import type { CardStatus } from '../types'

/**
 * Checks whether a due date lies in the past.
 *
 * @param dueDate - ISO date string or nullish when unscheduled
 * @param now - Reference time (defaults to current time)
 * @returns True when a due date exists and is earlier than now
 */
export function isOverdue(dueDate: string | null | undefined, now: Date = new Date()): boolean {
  if (!dueDate) return false
  return new Date(dueDate).getTime() < now.getTime()
}

/**
 * Resolves card completion status across field representations or CardStatus value.
 *
 * @param target - Card carrying either completion flag, or CardStatus string
 * @returns True when complete or status is 'done'/'closed'
 */
export function isCardComplete(
  target?: { isComplete?: boolean; isCompleted?: boolean } | CardStatus | null,
): boolean {
  if (typeof target === 'string') {
    return target === 'done' || target === 'closed'
  }
  return target?.isComplete ?? target?.isCompleted ?? false
}

/**
 * Resolves the card cover image URL across field representations.
 *
 * @param card - Card carrying either cover field
 * @returns Cover URL or null when unset
 */
export function cardCoverUrl(card: { coverImageUrl?: string | null; coverUrl?: string | null }): string | null {
  return card.coverImageUrl ?? card.coverUrl ?? null
}
