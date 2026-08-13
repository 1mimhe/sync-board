import {
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { WorkspaceMemberGuard } from '../workspace-member.guard';
import { WorkspaceMemberRepository } from '../../repositories/workspace-member.repository';
import { WorkspaceRole } from '@prisma/client';

describe('WorkspaceMemberGuard', () => {
  let guard: WorkspaceMemberGuard;
  let memberRepo: jest.Mocked<WorkspaceMemberRepository>;

  beforeEach(() => {
    memberRepo = {
      findMember: jest.fn(),
    } as unknown as jest.Mocked<WorkspaceMemberRepository>;

    guard = new WorkspaceMemberGuard(memberRepo);
  });

  const createMockContext = (
    params: Record<string, string>,
    user: Record<string, string>,
  ): ExecutionContext => {
    const request = { params, user };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  };

  it('should allow access and attach workspaceMember if user is a member', async () => {
    const mockMember = {
      id: '4c57a2e8-6e0a-4f5e-9c1b-7f0a2e3d4c5b',
      workspaceId: 'f0e8d7c6-b5a4-4938-a2b1-0c1d2e3f4a5b',
      userId: '3a2b1c0d-9e8f-4a7b-8c6d-5e4f3a2b1c0d',
      role: WorkspaceRole.member,
      joinedAt: new Date(),
    };

    (memberRepo.findMember as jest.Mock).mockResolvedValue(mockMember);

    const context = createMockContext(
      { workspaceId: 'f0e8d7c6-b5a4-4938-a2b1-0c1d2e3f4a5b' },
      { sub: '3a2b1c0d-9e8f-4a7b-8c6d-5e4f3a2b1c0d' },
    );
    const canActivate = await guard.canActivate(context);

    expect(canActivate).toBe(true);
    const req = context.switchToHttp().getRequest();
    expect(req.workspaceMember).toEqual(mockMember);
  });

  it('should throw ForbiddenException if user or workspaceId is missing', async () => {
    const context = createMockContext({}, { sub: 'user-123' });
    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should throw ForbiddenException if user is not a member', async () => {
    (memberRepo.findMember as jest.Mock).mockResolvedValue(null);

    const context = createMockContext(
      { workspaceId: 'f0e8d7c6-b5a4-4938-a2b1-0c1d2e3f4a5b' },
      { sub: '9e8f7a6b-5c4d-4e3f-8a9b-0c1d2e3f4a5b' },
    );
    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should throw BadRequestException without querying the DB for a malformed workspaceId', async () => {
    const context = createMockContext(
      { workspaceId: 'not-a-uuid' },
      { sub: '3a2b1c0d-9e8f-4a7b-8c6d-5e4f3a2b1c0d' },
    );

    await expect(guard.canActivate(context)).rejects.toThrow(
      BadRequestException,
    );
    expect(memberRepo.findMember).not.toHaveBeenCalled();
  });
});
