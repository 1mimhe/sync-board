import { ExecutionContext } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { WsBoardAccessGuard } from '../ws-board-access.guard';
import { BoardRepository } from '../../repositories/board.repository';
import { WorkspaceMemberRepository } from '../../../workspace/repositories/workspace-member.repository';

describe('WsBoardAccessGuard', () => {
  let guard: WsBoardAccessGuard;
  let boardRepo: DeepMockProxy<BoardRepository>;
  let workspaceMemberRepo: DeepMockProxy<WorkspaceMemberRepository>;
  let mockContext: DeepMockProxy<ExecutionContext>;
  let mockWsContext: any;
  let mockSocket: any;

  const validUserId = '123e4567-e89b-42d3-a456-426614174000';
  const validBoardId = '123e4567-e89b-42d3-a456-426614174001';
  const validWorkspaceId = '123e4567-e89b-42d3-a456-426614174002';

  beforeEach(() => {
    boardRepo = mockDeep<BoardRepository>();
    workspaceMemberRepo = mockDeep<WorkspaceMemberRepository>();
    guard = new WsBoardAccessGuard(boardRepo, workspaceMemberRepo);

    mockSocket = {
      id: 'socket-123',
      data: {
        user: {
          sub: validUserId,
        },
      },
    };

    mockWsContext = {
      getClient: jest.fn().mockReturnValue(mockSocket),
      getData: jest.fn().mockReturnValue({ boardId: validBoardId }),
    };

    mockContext = mockDeep<ExecutionContext>();
    mockContext.switchToWs.mockReturnValue(mockWsContext);
  });

  it('should allow access when board is active and user is a workspace member', async () => {
    boardRepo.findById.mockResolvedValue({
      id: validBoardId,
      workspaceId: validWorkspaceId,
      title: 'Active Board',
    } as any);

    workspaceMemberRepo.findMember.mockResolvedValue({
      id: 'member-1',
      workspaceId: validWorkspaceId,
      userId: validUserId,
    } as any);

    const result = await guard.canActivate(mockContext);
    expect(result).toBe(true);
    expect(boardRepo.findById).toHaveBeenCalledWith(validBoardId);
    expect(workspaceMemberRepo.findMember).toHaveBeenCalledWith(validWorkspaceId, validUserId);
  });

  it('should throw BOARD_NOT_FOUND when board does not exist or is archived', async () => {
    boardRepo.findById.mockResolvedValue(null);

    await expect(guard.canActivate(mockContext)).rejects.toThrow(WsException);

    try {
      await guard.canActivate(mockContext);
    } catch (error) {
      expect(error).toBeInstanceOf(WsException);
      const wsErr = (error as WsException).getError() as { code: string; message: string };
      expect(wsErr.code).toBe('BOARD_NOT_FOUND');
    }
  });

  it('should throw BOARD_ACCESS_DENIED when user is not a member of board workspace', async () => {
    boardRepo.findById.mockResolvedValue({
      id: validBoardId,
      workspaceId: validWorkspaceId,
    } as any);
    workspaceMemberRepo.findMember.mockResolvedValue(null);

    await expect(guard.canActivate(mockContext)).rejects.toThrow(WsException);

    try {
      await guard.canActivate(mockContext);
    } catch (error) {
      expect(error).toBeInstanceOf(WsException);
      const wsErr = (error as WsException).getError() as { code: string; message: string };
      expect(wsErr.code).toBe('BOARD_ACCESS_DENIED');
    }
  });

  it('should throw TOKEN_INVALID when socket has no user', async () => {
    mockSocket.data = {};

    await expect(guard.canActivate(mockContext)).rejects.toThrow(WsException);
  });

  it('should allow access if payload does not specify boardId', async () => {
    mockWsContext.getData.mockReturnValue({});

    const result = await guard.canActivate(mockContext);
    expect(result).toBe(true);
  });
});
