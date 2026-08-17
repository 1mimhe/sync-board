import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { WorkspaceController } from './controllers/workspace.controller';
import { WorkspaceService } from './services/workspace.service';
import { WorkspaceRepository } from './repositories/workspace.repository';
import { WorkspaceMemberRepository } from './repositories/workspace-member.repository';
import { WorkspaceInvitationRepository } from './repositories/workspace-invitation.repository';
import { WorkspaceMemberGuard } from './guards/workspace-member.guard';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [WorkspaceController],
  providers: [
    WorkspaceService,
    WorkspaceRepository,
    WorkspaceMemberRepository,
    WorkspaceInvitationRepository,
    WorkspaceMemberGuard,
    RbacGuard,
  ],
  exports: [
    WorkspaceService,
    WorkspaceRepository,
    WorkspaceMemberRepository,
    WorkspaceInvitationRepository,
    WorkspaceMemberGuard,
    RbacGuard,
  ],
})
export class WorkspaceModule {}
