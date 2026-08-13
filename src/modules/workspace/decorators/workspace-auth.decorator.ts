import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { WorkspaceRole } from '@prisma/client';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { WorkspaceMemberGuard } from '../guards/workspace-member.guard';

/**
 * Convenience composition decorator applying JWT authentication, workspace membership verification,
 * RBAC role checking, and Swagger annotations.
 *
 * @param roles Permitted workspace roles (e.g. 'owner', 'admin', 'member', 'viewer')
 */
export function WorkspaceAuth(...roles: WorkspaceRole[]) {
  const normalizedRoles = roles.map((r) => r.toLowerCase() as WorkspaceRole);

  return applyDecorators(
    SetMetadata('roles', normalizedRoles),
    UseGuards(JwtAuthGuard, WorkspaceMemberGuard, RbacGuard),
    ApiBearerAuth(),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({
      status: 403,
      description: 'Forbidden — insufficient workspace permissions',
    }),
  );
}
