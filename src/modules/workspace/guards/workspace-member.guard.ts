import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { RequestWithWorkspaceMember } from '../../../common/interfaces/request-with-workspace-member.interface';
import { WorkspaceMemberRepository } from '../repositories/workspace-member.repository';
import { UUID_V4_SCHEMA } from './workspace-member.constants';

/**
 * Guard that verifies the authenticated user is an active member of the target workspace.
 * Attaches the workspace member record to `request.workspaceMember`.
 */
@Injectable()
export class WorkspaceMemberGuard implements CanActivate {
  constructor(private readonly memberRepo: WorkspaceMemberRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithWorkspaceMember>();

    const userId = request.user?.sub;
    const rawWorkspaceId = request.params.workspaceId || request.params.id;
    const workspaceId = Array.isArray(rawWorkspaceId)
      ? rawWorkspaceId[0]
      : rawWorkspaceId;

    if (!userId || !workspaceId) {
      throw new ForbiddenException('FORBIDDEN');
    }

    const { error } = UUID_V4_SCHEMA.validate(workspaceId);
    if (error) {
      throw new BadRequestException('Validation failed (uuid is expected)');
    }

    const member = await this.memberRepo.findMember(workspaceId, userId);
    if (!member) {
      throw new ForbiddenException('FORBIDDEN');
    }

    request.workspaceMember = member;
    return true;
  }
}
