import type { WorkspaceRole } from '@prisma/client';

/** Metadata key storing required workspace roles. */
export const ROLES_METADATA_KEY = 'roles';

/** Hierarchical weight for each workspace role (owner > admin > member > viewer). */
export const ROLE_WEIGHTS: Record<WorkspaceRole, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
};

/**
 * Named role sets for `@WorkspaceAuth()`.
 * The guard enforces the minimum weight, so each set means "this role or higher".
 */
export const WORKSPACE_OWNER_ROLES: readonly WorkspaceRole[] = ['owner'];

export const WORKSPACE_ADMIN_ROLES: readonly WorkspaceRole[] = [
  'owner',
  'admin',
];

export const WORKSPACE_WRITE_ROLES: readonly WorkspaceRole[] = [
  'owner',
  'admin',
  'member',
];

export const WORKSPACE_READ_ROLES: readonly WorkspaceRole[] = [
  'owner',
  'admin',
  'member',
  'viewer',
];
