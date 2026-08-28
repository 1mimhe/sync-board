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

  /**
   * Finds a cursor page of non-archived workspaces for a user with their role,
   * newest first. Fetches limit + 1 rows so callers can compute hasMore.
   *
   * Unknown/stale cursors are tolerated: when Prisma cannot locate the cursor row,
   * the query is retried without it, returning the newest page.
   *
   * @param userId - User UUID
   * @param cursor - Last item id of the previous page (optional)
   * @param limit - Page size; one extra row is fetched to detect the next page
   * @returns Array of workspaces mapped with user role (length up to limit + 1)
   */
  async findUserWorkspacesPage(
    userId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<WorkspaceWithRole[]> {
    const find = (withCursor: boolean) =>
      this.prisma.workspace.findMany({
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
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        ...(withCursor && cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

    let workspaces;
    try {
      workspaces = await find(true);
    } catch (error) {
      if (
        cursor &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        // Unknown/stale cursor — degrade gracefully to the newest page
        workspaces = await find(false);
      } else {
        throw error;
      }
    }

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
