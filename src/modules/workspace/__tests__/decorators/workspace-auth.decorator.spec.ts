import { WorkspaceAuth } from '../../decorators/workspace-auth.decorator';
import { WorkspaceRole } from '@prisma/client';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { WorkspaceMemberGuard } from '../../guards/workspace-member.guard';
import { RbacGuard } from '../../../../common/guards/rbac.guard';

describe('WorkspaceAuth Decorator', () => {
  it('should apply roles metadata and guards to target class or method', () => {
    class TestController {
      @WorkspaceAuth(WorkspaceRole.owner, WorkspaceRole.admin)
      testEndpoint() {}
    }

    const rolesMetadata = Reflect.getMetadata('roles', TestController.prototype.testEndpoint);
    expect(rolesMetadata).toEqual(['owner', 'admin']);

    const guards = Reflect.getMetadata(GUARDS_METADATA, TestController.prototype.testEndpoint);
    expect(guards).toEqual([JwtAuthGuard, WorkspaceMemberGuard, RbacGuard]);
  });
});
