import type { CardStatus } from '@prisma/client';

/** Statuses that imply isComplete=true. Single source of truth. */
export const COMPLETE_STATUSES: ReadonlySet<CardStatus> = new Set([
  'done',
  'closed',
]);
