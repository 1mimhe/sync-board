import type { CardChecklist } from '@prisma/client';

/**
 * Internal event names for checklist domain side effects.
 */
export const CHECKLIST_EVENTS = {
  created: 'checklist.created',
  updated: 'checklist.updated',
  deleted: 'checklist.deleted',
} as const;

/**
 * Emitted after a new checklist is created on a card.
 */
export class ChecklistCreatedEvent {
  constructor(
    public readonly checklist: CardChecklist,
    public readonly boardId: string,
    public readonly createdBy: string,
  ) {}
}

/**
 * Emitted after a checklist (or one of its items) changes progress/content.
 */
export class ChecklistUpdatedEvent {
  constructor(
    public readonly checklistId: string,
    public readonly cardId: string,
    public readonly boardId: string,
    public readonly updatedBy: string,
  ) {}
}

/**
 * Emitted after a checklist is deleted (items cascade).
 */
export class ChecklistDeletedEvent {
  constructor(
    public readonly checklistId: string,
    public readonly cardId: string,
    public readonly boardId: string,
    public readonly deletedBy: string,
  ) {}
}
