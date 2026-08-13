import type { Request } from 'express';
import type { WorkspaceMember } from '@prisma/client';

/**
 * HTTP request enriched by `JwtAuthGuard` (user) and `WorkspaceMemberGuard`
 * (workspaceMember). Used by RBAC guards and controllers to resolve the
 * authenticated user and their workspace membership.
 */
export interface RequestWithWorkspaceMember extends Request {
  user?: {
    sub: string;
    email: string;
    displayName: string;
    [key: string]: unknown;
  };
  workspaceMember?: WorkspaceMember;
}
