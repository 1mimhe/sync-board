import type { Label } from '@prisma/client';

/** Event emitted after a label is created (board-specific or workspace-level). */
export class LabelCreatedEvent {
  constructor(
    public readonly label: Label,
    public readonly workspaceId: string,
    public readonly boardId: string | null,
    public readonly createdBy: string,
  ) {}
}

/** Event emitted after a label is updated. */
export class LabelUpdatedEvent {
  constructor(
    public readonly label: Label,
    public readonly boardId: string,
    public readonly updatedBy: string,
  ) {}
}

/** Event emitted after a label is deleted. */
export class LabelDeletedEvent {
  constructor(
    public readonly labelId: string,
    public readonly boardId: string,
    public readonly deletedBy: string,
  ) {}
}
