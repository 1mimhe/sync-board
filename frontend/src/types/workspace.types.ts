import type { WorkspaceRole } from './auth.types'

export interface Workspace {
  id: string
  name: string
  slug: string
  ownerId: string
  role?: WorkspaceRole
  createdAt: string
  updatedAt: string
  archivedAt?: string | null
}

export interface WorkspaceWithRole extends Workspace {
  role: WorkspaceRole
}

export interface WorkspaceMember {
  id: string
  workspaceId: string
  userId: string
  role: WorkspaceRole
  joinedAt: string
  user: {
    id: string
    email: string
    displayName: string
    avatarUrl?: string | null
  }
}

export interface WorkspaceInvitation {
  id: string
  workspaceId: string
  email: string
  role: WorkspaceRole
  token: string
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED'
  expiresAt: string
  createdAt: string
  inviter?: {
    id: string
    displayName: string
    email: string
  }
}
