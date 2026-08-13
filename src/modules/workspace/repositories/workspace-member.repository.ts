import { Injectable } from '@nestjs/common';
import { WorkspaceMember, WorkspaceRole } from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma.service';
import { MemberWithUser } from '../interfaces/workspace.interfaces';

@Injectable()
export class WorkspaceMemberRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMember(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMember | null> {
    return this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId },
      },
    });
  }

  async findMemberById(memberId: string): Promise<WorkspaceMember | null> {
    return this.prisma.workspaceMember.findUnique({
      where: { id: memberId },
    });
  }

  async findMembersWithUser(workspaceId: string): Promise<MemberWithUser[]> {
    return this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });
  }

  async countOwners(workspaceId: string): Promise<number> {
    return this.prisma.workspaceMember.count({
      where: {
        workspaceId,
        role: WorkspaceRole.owner,
      },
    });
  }

  async createMember(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
  ): Promise<WorkspaceMember> {
    return this.prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId,
        role,
      },
    });
  }

  async updateRole(
    memberId: string,
    role: WorkspaceRole,
  ): Promise<WorkspaceMember> {
    return this.prisma.workspaceMember.update({
      where: { id: memberId },
      data: { role },
    });
  }

  async removeMember(memberId: string): Promise<void> {
    await this.prisma.workspaceMember.delete({
      where: { id: memberId },
    });
  }
}
