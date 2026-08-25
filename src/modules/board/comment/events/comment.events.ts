import type { CardComment } from '@prisma/client';

/** Event emitted after a comment is created on a card. */
export class CommentCreatedEvent {
  constructor(
    public readonly comment: CardComment,
    public readonly boardId: string,
    public readonly authorId: string,
  ) {}
}
