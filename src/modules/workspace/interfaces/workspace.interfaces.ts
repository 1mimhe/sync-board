import {
  Workspace,
  WorkspaceMember,
  WorkspaceInvitation,
  WorkspaceRole,
} from '@prisma/client';

export interface WorkspaceWithRole extends Workspace {
  role: WorkspaceRole;
}

export interface MemberUserSummary {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
}

export interface MemberWithUser extends WorkspaceMember {
  user: MemberUserSummary;
}

export interface WorkspaceInvitationWithInviter extends WorkspaceInvitation {
  inviter: MemberUserSummary;
}
