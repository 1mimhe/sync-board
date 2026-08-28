import type { CardComment } from '@prisma/client';

/** Event emitted after a comment is created on a card. */
export class CommentCreatedEvent {
  constructor(
    public readonly comment: CardComment,
    public readonly boardId: string,
    public readonly authorId: string,
  ) {}
}

/** Event emitted after a comment is edited. */
export class CommentUpdatedEvent {
  constructor(
    public readonly comment: CardComment,
    public readonly boardId: string,
    public readonly updatedBy: string,
  ) {}
}

/** Event emitted after a comment is soft-deleted. */
export class CommentDeletedEvent {
  constructor(
    public readonly commentId: string,
    public readonly cardId: string,
    public readonly boardId: string,
    public readonly deletedBy: string,
  ) {}
}
