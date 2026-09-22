/**
 * Minimal attachment shape carried on attachment events (the interim
 * card-attachments table is replaced by S3-backed files).
 */
export interface AttachmentEventTarget {
  id: string;
  cardId: string;
}

/** Event emitted after an attachment is added to a card. */
export class AttachmentCreatedEvent {
  constructor(
    public readonly attachment: AttachmentEventTarget,
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
