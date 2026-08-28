import { ExecutionContext } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { WsWorkspaceMemberGuard } from '../../guards/ws-workspace-member.guard';
import { WorkspaceMemberRepository } from '../../repositories/workspace-member.repository';

describe('WsWorkspaceMemberGuard', () => {
  let guard: WsWorkspaceMemberGuard;
  let memberRepo: DeepMockProxy<WorkspaceMemberRepository>;
  let mockContext: DeepMockProxy<ExecutionContext>;
  let mockWsContext: any;
  let mockSocket: any;

  const validUserId = '123e4567-e89b-42d3-a456-426614174000';
  const validWorkspaceId = '123e4567-e89b-42d3-a456-426614174001';

  beforeEach(() => {
    memberRepo = mockDeep<WorkspaceMemberRepository>();
    guard = new WsWorkspaceMemberGuard(memberRepo);

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
      getData: jest.fn().mockReturnValue({ workspaceId: validWorkspaceId }),
    };

    mockContext = mockDeep<ExecutionContext>();
    mockContext.switchToWs.mockReturnValue(mockWsContext);
  });

  it('should allow access when user is a workspace member', async () => {
    memberRepo.findMember.mockResolvedValue({
      id: 'member-1',
      workspaceId: validWorkspaceId,
      userId: validUserId,
      role: 'member',
      joinedAt: new Date(),
    } as any);

    const result = await guard.canActivate(mockContext);
    expect(result).toBe(true);
    expect(memberRepo.findMember).toHaveBeenCalledWith(
      validWorkspaceId,
      validUserId,
    );
  });

  it('should throw BOARD_ACCESS_DENIED WsException when user is not a member', async () => {
    memberRepo.findMember.mockResolvedValue(null);

    await expect(guard.canActivate(mockContext)).rejects.toThrow(WsException);

    try {
      await guard.canActivate(mockContext);
    } catch (error) {
      expect(error).toBeInstanceOf(WsException);
      const wsErr = (error as WsException).getError() as {
        code: string;
        message: string;
      };
      expect(wsErr.code).toBe('BOARD_ACCESS_DENIED');
      expect(wsErr.message).toContain('not a member of this workspace');
    }
  });

  it('should throw TOKEN_INVALID when socket has no user', async () => {
    mockSocket.data = {};

    await expect(guard.canActivate(mockContext)).rejects.toThrow(WsException);
  });

  it('should allow access if payload does not have workspaceId', async () => {
    mockWsContext.getData.mockReturnValue({});

    const result = await guard.canActivate(mockContext);
    expect(result).toBe(true);
  });
});
