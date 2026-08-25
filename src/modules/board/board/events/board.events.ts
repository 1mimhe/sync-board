import type { Board } from '@prisma/client';

/** Event emitted after a new board is created. */
export class BoardCreatedEvent {
  constructor(
    public readonly board: Board,
    public readonly createdBy: string,
  ) {}
}

/** Event emitted after a board's metadata is updated. */
export class BoardUpdatedEvent {
  constructor(
    public readonly board: Board,
    public readonly updatedBy: string,
  ) {}
}

/** Event emitted after a board is soft-deleted (archived). */
export class BoardArchivedEvent {
  constructor(
    public readonly boardId: string,
    public readonly workspaceId: string,
    public readonly archivedBy: string,
  ) {}
}

/** Event emitted after an archived board is restored (unarchived). */
export class BoardUnarchivedEvent {
  constructor(
    public readonly board: Board,
    public readonly unarchivedBy: string,
  ) {}
}
