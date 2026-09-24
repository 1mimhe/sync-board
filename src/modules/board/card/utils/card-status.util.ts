import type { CardStatus } from '@prisma/client';
import { COMPLETE_STATUSES } from '../card.constants';

/**
 * Checks whether a status change should proceed.
 * Status flow is free: any distinct status is allowed, including reopening
 * closed cards; same-status writes are no-ops.
 *
 * @param from - Current status
 * @param to - Requested status
 * @returns True when the transition should proceed
 */
export function isStatusTransitionAllowed(
  from: CardStatus,
  to: CardStatus,
): boolean {
  return from !== to;
}

/**
 * Derives completion from status.
 *
 * @param status - Card status
 * @returns True for done and closed, false otherwise
 */
export function isCompleteFromStatus(status: CardStatus): boolean {
  return COMPLETE_STATUSES.has(status);
}
