import { Workspace, WorkspaceRole } from '@prisma/client';

export class WorkspaceCreatedEvent {
  constructor(
    public readonly workspace: Workspace,
    public readonly ownerId: string,
  ) {}
}

export class WorkspaceMemberAddedEvent {
  constructor(
    public readonly workspaceId: string,
    public readonly userId: string,
    public readonly role: WorkspaceRole,
  ) {}
}

export class WorkspaceMemberRemovedEvent {
  constructor(
    public readonly workspaceId: string,
    public readonly userId: string,
  ) {}
}

/**
 * Emitted when a member leaves a workspace on their own initiative
 * (distinct from admin-initiated removal).
 */
export class WorkspaceMemberLeftEvent {
  constructor(
    public readonly workspaceId: string,
    public readonly userId: string,
  ) {}
}

/**
 * Emitted after an ownership transfer transaction commits.
 */
export class WorkspaceOwnershipTransferredEvent {
  constructor(
    public readonly workspaceId: string,
    public readonly previousOwnerId: string,
    public readonly newOwnerId: string,
  ) {}
}

export class WorkspaceMemberRoleChangedEvent {
  constructor(
    public readonly workspaceId: string,
    public readonly userId: string,
    public readonly oldRole: WorkspaceRole,
    public readonly newRole: WorkspaceRole,
  ) {}
}

export class WorkspaceInvitationCreatedEvent {
  constructor(
    public readonly workspaceId: string,
    public readonly email: string,
    public readonly invitedBy: string,
    public readonly token: string,
  ) {}
}
