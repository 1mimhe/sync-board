import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WorkspaceRole } from '@prisma/client';
import { RequestWithWorkspaceMember } from '../interfaces/request-with-workspace-member.interface';

const ROLE_WEIGHTS: Record<WorkspaceRole, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
};

/**
 * Guard that enforces Role-Based Access Control (RBAC) on workspace actions.
 * Compares member role weight against required roles retrieved from metadata.
 */
@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<WorkspaceRole[]>(
      'roles',
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<RequestWithWorkspaceMember>();

    const member = request.workspaceMember;
    if (!member) {
      throw new ForbiddenException('FORBIDDEN');
    }

    const userWeight = ROLE_WEIGHTS[member.role] ?? 0;
    const minRequiredWeight = Math.min(
      ...requiredRoles.map((r) => ROLE_WEIGHTS[r] ?? 0),
    );

    if (userWeight < minRequiredWeight) {
      throw new ForbiddenException('FORBIDDEN');
    }

    return true;
  }
}
