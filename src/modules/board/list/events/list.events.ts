import type { List } from '@prisma/client';

/** Event emitted after a new list is created within a board. */
export class ListCreatedEvent {
  constructor(
    public readonly list: List,
    public readonly createdBy: string,
  ) {}
}

/** Event emitted after a list's title or properties are updated. */
export class ListUpdatedEvent {
  constructor(
    public readonly list: List,
    public readonly updatedBy: string,
  ) {}
}

/** Event emitted after a list is archived. */
export class ListArchivedEvent {
  constructor(
    public readonly listId: string,
    public readonly boardId: string,
    public readonly archivedBy: string,
  ) {}
}

/** Event emitted after an archived list is restored. */
export class ListUnarchivedEvent {
  constructor(
    public readonly list: List,
    public readonly unarchivedBy: string,
  ) {}
}

/** Event emitted after a list is reordered (LexoRank updated). */
export class ListMovedEvent {
  constructor(
    public readonly listId: string,
    public readonly boardId: string,
    public readonly newRank: string,
    public readonly movedBy: string,
  ) {}
}

/** Event emitted after a list is permanently deleted (not retrievable). */
export class ListDeletedEvent {
  constructor(
    public readonly listId: string,
    public readonly boardId: string,
    public readonly deletedBy: string,
  ) {}
}
