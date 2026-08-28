import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { WorkspaceMemberRepository } from '../repositories/workspace-member.repository';
import { WS_EVENTS } from '../../board/realtime/ws-events.constants';
import type { AuthenticatedSocketData } from '../../../common/interfaces/ws.interface';

/**
 * Guard that verifies the authenticated WebSocket user is a member of the workspace
 * specified in the event payload (`payload.workspaceId`).
 */
@Injectable()
export class WsWorkspaceMemberGuard implements CanActivate {
  constructor(
    private readonly workspaceMemberRepo: WorkspaceMemberRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<Socket>();
    const data = context
      .switchToWs()
      .getData<{ workspaceId?: string } | undefined>();
    const socketData = client?.data as AuthenticatedSocketData | undefined;
    const userId = socketData?.user?.sub;

    if (!userId) {
      throw new WsException({
        code: 'TOKEN_INVALID',
        message: 'Authentication required',
      });
    }

    const workspaceId = data?.workspaceId;
    if (!workspaceId) {
      return true;
    }

    const member = await this.workspaceMemberRepo.findMember(
      workspaceId,
      userId,
    );
    if (!member) {
      throw new WsException({
        code: 'BOARD_ACCESS_DENIED',
        message: 'You are not a member of this workspace',
        event: WS_EVENTS.WORKSPACE_JOIN,
      });
    }

    return true;
  }
}
