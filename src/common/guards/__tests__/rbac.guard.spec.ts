import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RbacGuard } from '../rbac.guard';
import { WorkspaceRole } from '@prisma/client';

describe('RbacGuard', () => {
  let guard: RbacGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    guard = new RbacGuard(reflector);
  });

  const createMockContext = (workspaceMember?: any): ExecutionContext => {
    const request = { workspaceMember };
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  };

  it('should allow access if no roles metadata set', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const context = createMockContext();

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access if user weight meets min required role', () => {
    reflector.getAllAndOverride.mockReturnValue([WorkspaceRole.admin]);
    const context = createMockContext({ role: WorkspaceRole.owner });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should deny access if user weight is lower than min required role', () => {
    reflector.getAllAndOverride.mockReturnValue([WorkspaceRole.admin]);
    const context = createMockContext({ role: WorkspaceRole.member });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException if workspaceMember is missing when roles are required', () => {
    reflector.getAllAndOverride.mockReturnValue([WorkspaceRole.viewer]);
    const context = createMockContext(undefined);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
