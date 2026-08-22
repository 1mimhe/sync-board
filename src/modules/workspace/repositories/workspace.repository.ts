import { Injectable } from '@nestjs/common';
import { Prisma, Workspace, WorkspaceRole } from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma.service';
import { WorkspaceWithRole } from '../interfaces/workspace.interfaces';

@Injectable()
export class WorkspaceRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a workspace and attaches the owner membership record within a single database transaction.
   */
  async createWorkspaceWithOwner(
    data: {
      name: string;
      slug: string;
      description?: string;
      avatarUrl?: string;
    },
    ownerId: string,
  ): Promise<Workspace> {
    return this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name: data.name,
          slug: data.slug,
          description: data.description,
          avatarUrl: data.avatarUrl,
          ownerId,
        },
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: ownerId,
          role: WorkspaceRole.owner,
        },
      });

      return workspace;
    });
  }

  async findById(id: string): Promise<Workspace | null> {
    return this.prisma.workspace.findFirst({
      where: { id, archivedAt: null },
    });
  }

  async findBySlug(slug: string): Promise<Workspace | null> {
    return this.prisma.workspace.findFirst({
      where: { slug, archivedAt: null },
    });
  }

  async existsBySlug(slug: string): Promise<boolean> {
    return !!(await this.prisma.workspace.count({
      where: { slug },
    }));
  }

  async findUserWorkspaces(userId: string): Promise<WorkspaceWithRole[]> {
    const workspaces = await this.prisma.workspace.findMany({
      where: {
        archivedAt: null,
        members: {
          some: { userId },
        },
      },
      include: {
        members: {
          where: { userId },
          select: { role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return workspaces.map((ws) => {
      const role = ws.members[0]?.role ?? WorkspaceRole.viewer;
      const { members, ...rest } = ws;
      return {
        ...rest,
        role,
      };
    });
  }

  async update(
    id: string,
    data: Prisma.WorkspaceUpdateInput,
  ): Promise<Workspace> {
    return this.prisma.workspace.update({
      where: { id },
      data,
    });
  }

  async archive(id: string): Promise<void> {
    await this.prisma.workspace.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
  }
}
