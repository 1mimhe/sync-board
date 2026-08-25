import type { CardAttachment } from '@prisma/client';

/** Event emitted after an attachment is added to a card. */
export class AttachmentCreatedEvent {
  constructor(
    public readonly attachment: CardAttachment,
    public readonly boardId: string,
    public readonly uploadedBy: string,
  ) {}
}

/** Event emitted after an attachment is removed from a card. */
export class AttachmentDeletedEvent {
  constructor(
    public readonly attachmentId: string,
    public readonly cardId: string,
    public readonly boardId: string,
    public readonly deletedBy: string,
  ) {}
}
