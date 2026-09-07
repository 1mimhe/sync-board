import type { CardStatus } from '@prisma/client';
import { COMPLETE_STATUSES } from '../card.constants';

/**
 * Guards status transitions. Phase 5.5 uses free flow (any distinct status is
 * allowed, including reopening closed cards); same-status writes are no-ops.
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
 * Derives legacy isComplete from status (single source of truth is status).
 *
 * @param status - Card status
 * @returns True for done and closed, false otherwise
 */
export function isCompleteFromStatus(status: CardStatus): boolean {
  return COMPLETE_STATUSES.has(status);
}
