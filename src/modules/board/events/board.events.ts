import type {
  Board,
  List,
  Card,
  CardComment,
  CardAttachment,
} from '@prisma/client';

/**
 * Event emitted after a new board is created.
 */
export class BoardCreatedEvent {
  constructor(
    public readonly board: Board,
    public readonly createdBy: string,
  ) {}
}

/**
 * Event emitted after a board's metadata is updated.
 */
export class BoardUpdatedEvent {
  constructor(
    public readonly board: Board,
    public readonly updatedBy: string,
  ) {}
}

/**
 * Event emitted after a board is soft-deleted (archived).
 */
export class BoardArchivedEvent {
  constructor(
    public readonly boardId: string,
    public readonly workspaceId: string,
    public readonly archivedBy: string,
  ) {}
}

/**
 * Event emitted after an archived board is restored (unarchived).
 */
export class BoardUnarchivedEvent {
  constructor(
    public readonly board: Board,
    public readonly unarchivedBy: string,
  ) {}
}

/**
 * Event emitted after a new list is created within a board.
 */
export class ListCreatedEvent {
  constructor(
    public readonly list: List,
    public readonly createdBy: string,
  ) {}
}

/**
 * Event emitted after a list's title or properties are updated.
 */
export class ListUpdatedEvent {
  constructor(
    public readonly list: List,
    public readonly updatedBy: string,
  ) {}
}

/**
 * Event emitted after a list is archived.
 */
export class ListArchivedEvent {
  constructor(
    public readonly listId: string,
    public readonly boardId: string,
    public readonly archivedBy: string,
  ) {}
}

/**
 * Event emitted after an archived list is restored.
 */
export class ListUnarchivedEvent {
  constructor(
    public readonly list: List,
    public readonly unarchivedBy: string,
  ) {}
}

/**
 * Event emitted after a list is reordered (LexoRank updated).
 */
export class ListMovedEvent {
  constructor(
    public readonly listId: string,
    public readonly boardId: string,
    public readonly newRank: string,
    public readonly movedBy: string,
  ) {}
}

/**
 * Event emitted after a new card is created in a list.
 */
export class CardCreatedEvent {
  constructor(
    public readonly card: Card,
    public readonly boardId: string,
    public readonly listId: string,
    public readonly createdBy: string,
  ) {}
}

/**
 * Event emitted after a card is moved within or across lists with a new rank.
 */
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

/**
 * Event emitted after a card's fields (title, description, due date, completion, cover) are updated.
 */
export class CardUpdatedEvent {
  constructor(
    public readonly card: Card,
    public readonly boardId: string,
    public readonly updatedBy: string,
  ) {}
}

/**
 * Event emitted after a card is archived.
 */
export class CardArchivedEvent {
  constructor(
    public readonly cardId: string,
    public readonly boardId: string,
    public readonly listId: string,
    public readonly archivedBy: string,
  ) {}
}

/**
 * Event emitted after an archived card is unarchived.
 */
export class CardUnarchivedEvent {
  constructor(
    public readonly card: Card,
    public readonly boardId: string,
    public readonly listId: string,
    public readonly unarchivedBy: string,
  ) {}
}

/**
 * Event emitted after a comment is created on a card.
 */
export class CommentCreatedEvent {
  constructor(
    public readonly comment: CardComment,
    public readonly boardId: string,
    public readonly authorId: string,
  ) {}
}

/**
 * Event emitted after an attachment is added to a card.
 */
export class AttachmentCreatedEvent {
  constructor(
    public readonly attachment: CardAttachment,
    public readonly boardId: string,
    public readonly uploadedBy: string,
  ) {}
}

/**
 * Event emitted after an attachment is removed from a card.
 */
export class AttachmentDeletedEvent {
  constructor(
    public readonly attachmentId: string,
    public readonly cardId: string,
    public readonly boardId: string,
    public readonly deletedBy: string,
  ) {}
}
