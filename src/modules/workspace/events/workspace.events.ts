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
