import { WorkspaceAuth } from '../../decorators/workspace-auth.decorator';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../../../../common/guards/email-verified.guard';
import { WorkspaceMemberGuard } from '../../guards/workspace-member.guard';
import { RbacGuard } from '../../../../common/guards/rbac.guard';
import {
  ROLES_METADATA_KEY,
  WORKSPACE_ADMIN_ROLES,
} from '../../../../common/guards/rbac.constants';

describe('WorkspaceAuth Decorator', () => {
  it('should apply roles metadata and guards to target class or method', () => {
    class TestController {
      @WorkspaceAuth(...WORKSPACE_ADMIN_ROLES)
      testEndpoint() {}
    }

    const rolesMetadata = Reflect.getMetadata(
      ROLES_METADATA_KEY,
      TestController.prototype.testEndpoint,
    );
    expect(rolesMetadata).toEqual([...WORKSPACE_ADMIN_ROLES]);

    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      TestController.prototype.testEndpoint,
    );
    expect(guards).toEqual([
      JwtAuthGuard,
      EmailVerifiedGuard,
      WorkspaceMemberGuard,
      RbacGuard,
    ]);
  });
});
