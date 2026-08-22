import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { BoardRepository } from '../repositories/board.repository';
import { WorkspaceMemberRepository } from '../../workspace/repositories/workspace-member.repository';
import { WS_EVENTS } from '../board.constants';
import type { AuthenticatedSocketData } from '../../../common/interfaces/ws.interface';

/**
 * Guard that verifies the requested board exists, is not archived,
 * and that the authenticated WebSocket user is a member of the parent workspace.
 */
@Injectable()
export class WsBoardAccessGuard implements CanActivate {
  constructor(
    private readonly boardRepo: BoardRepository,
    private readonly workspaceMemberRepo: WorkspaceMemberRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<Socket>();
    const data = context.switchToWs().getData<{ boardId?: string } | undefined>();
    const socketData = client?.data as AuthenticatedSocketData | undefined;
    const userId = socketData?.user?.sub;

    if (!userId) {
      throw new WsException({
        code: 'TOKEN_INVALID',
        message: 'Authentication required',
      });
    }

    const boardId = data?.boardId;
    if (!boardId) {
      return true;
    }

    const board = await this.boardRepo.findById(boardId);
    if (!board) {
      throw new WsException({
        code: 'BOARD_NOT_FOUND',
        message: 'Board does not exist or is archived',
        event: WS_EVENTS.BOARD_JOIN,
      });
    }

    const member = await this.workspaceMemberRepo.findMember(
      board.workspaceId,
      userId,
    );
    if (!member) {
      throw new WsException({
        code: 'BOARD_ACCESS_DENIED',
        message: 'You do not have access to this board',
        event: WS_EVENTS.BOARD_JOIN,
      });
    }

    return true;
  }
}
