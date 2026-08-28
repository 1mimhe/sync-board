import type { Card } from '@prisma/client';

/** Event emitted after a new card is created in a list. */
export class CardCreatedEvent {
  constructor(
    public readonly card: Card,
    public readonly boardId: string,
    public readonly listId: string,
    public readonly createdBy: string,
  ) {}
}

/** Event emitted after a card is moved within or across lists with a new rank. */
export class CardMovedEvent {
  constructor(
    public readonly cardId: string,
    public readonly boardId: string,
    public readonly sourceListId: string,
    public readonly targetListId: string,
    public readonly newRank: string,
    public readonly movedBy: string,
  ) {}
}

/** Event emitted after a card's fields are updated. */
export class CardUpdatedEvent {
  constructor(
    public readonly card: Card,
    public readonly boardId: string,
    public readonly updatedBy: string,
  ) {}
}

/** Event emitted after a card is archived. */
export class CardArchivedEvent {
  constructor(
    public readonly cardId: string,
    public readonly boardId: string,
    public readonly listId: string,
    public readonly archivedBy: string,
  ) {}
}

/** Event emitted after an archived card is unarchived. */
export class CardUnarchivedEvent {
  constructor(
    public readonly card: Card,
    public readonly boardId: string,
    public readonly listId: string,
    public readonly unarchivedBy: string,
  ) {}
}

/** Event emitted after a user is assigned to a card. */
export class CardAssigneeAddedEvent {
  constructor(
    public readonly cardId: string,
    public readonly boardId: string,
    public readonly userId: string,
    public readonly addedBy: string,
  ) {}
}

/** Event emitted after a user is unassigned from a card. */
export class CardAssigneeRemovedEvent {
  constructor(
    public readonly cardId: string,
    public readonly boardId: string,
    public readonly userId: string,
    public readonly removedBy: string,
  ) {}
}
