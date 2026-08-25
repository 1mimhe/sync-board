import type { CardChecklist, ChecklistItem } from '@prisma/client';

/**
 * Checklist entity including its ordered items.
 */
export type ChecklistWithItems = CardChecklist & { items: ChecklistItem[] };

/**
 * Checklist item entity including its parent checklist.
 */
export type ItemWithChecklist = ChecklistItem & { checklist: CardChecklist };
