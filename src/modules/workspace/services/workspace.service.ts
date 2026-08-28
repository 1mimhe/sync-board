import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Prisma, Workspace } from '@prisma/client';
import { randomBytes } from 'crypto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WorkspaceRepository } from '../repositories/workspace.repository';
import { WorkspaceMemberRepository } from '../repositories/workspace-member.repository';
import { CreateWorkspaceDto } from '../dto/create-workspace.dto';
import { UpdateWorkspaceDto } from '../dto/update-workspace.dto';
import type { WorkspaceWithRole } from '../interfaces/workspace.interfaces';
import { WorkspaceCreatedEvent } from '../events/workspace.events';
import { WORKSPACE_EVENTS } from '../events/workspace-events.constants';
import {
  EntityNotFoundException,
  BusinessRuleException,
} from '../../../common/exceptions/app.exception';

/**
 * Core workspace lifecycle: creation with unique-slug handling, member-scoped
 * reads, updates, archival, and membership checks.
 */
@Injectable()
export class WorkspaceService {
  private readonly logger = new Logger(WorkspaceService.name);

  constructor(
    private readonly workspaceRepo: WorkspaceRepository,
    private readonly memberRepo: WorkspaceMemberRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create a new workspace, generate a unique slug, set creator as OWNER, and emit `workspace.created`.
   * Handles unique slug race conditions by retrying with random suffix on conflict.
   */
  async create(dto: CreateWorkspaceDto, userId: string): Promise<Workspace> {
    this.logger.debug(`Creating workspace '${dto.name}' for user ${userId}`);
    let slug = await this.generateUniqueSlug(dto.name);
    let attempts = 0;

    while (attempts < 3) {
      try {
        const workspace = await this.workspaceRepo.createWorkspaceWithOwner(
          {
            name: dto.name,
            slug,
            description: dto.description,
            avatarUrl: dto.avatarUrl,
          },
          userId,
        );

        this.eventEmitter.emit(
          WORKSPACE_EVENTS.created,
          new WorkspaceCreatedEvent(workspace, userId),
        );

        this.logger.log(`Workspace created: ${workspace.id} (slug: ${slug})`);
        return workspace;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          attempts++;
          slug = await this.generateUniqueSlug(dto.name);
          continue;
        }
        throw error;
      }
    }
    throw new BusinessRuleException(
      'SLUG_COLLISION',
      'Could not generate unique workspace slug, please try again',
    );
  }

  /**
   * List all non-archived workspaces for a given user, including their role in each.
   */
  async findAllForUser(userId: string): Promise<WorkspaceWithRole[]> {
    return this.workspaceRepo.findUserWorkspaces(userId);
  }

  /**
   * Retrieve active workspace by ID.
   * @throws EntityNotFoundException if workspace not found or archived
   */
  private async findById(workspaceId: string): Promise<Workspace> {
    const workspace = await this.workspaceRepo.findById(workspaceId);
    if (!workspace) {
      throw new EntityNotFoundException('Workspace', workspaceId);
    }
    return workspace;
  }

  /**
   * Retrieve active workspace details by ID including requesting user's role.
   */
  async findByIdWithRole(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceWithRole> {
    const workspace = await this.findById(workspaceId);
    const membership = await this.memberRepo.findMember(workspaceId, userId);
    if (!membership) {
      throw new ForbiddenException('FORBIDDEN');
    }
    return {
      ...workspace,
      role: membership.role,
    };
  }

  /**
   * Retrieve active workspace details by unique slug.
   *
   * Resolves the requesting user's actual role in the workspace instead of
   * assuming ownership. Access is restricted to workspace members.
   *
   * @throws EntityNotFoundException if workspace not found
   * @throws ForbiddenException if the user is not a member of the workspace
   */
  async findBySlug(slug: string, userId: string): Promise<WorkspaceWithRole> {
    const workspace = await this.workspaceRepo.findBySlug(slug);
    if (!workspace) {
      throw new EntityNotFoundException('Workspace', slug);
    }

    const membership = await this.memberRepo.findMember(workspace.id, userId);
    if (!membership) {
      throw new ForbiddenException('FORBIDDEN');
    }

    return {
      ...workspace,
      role: membership.role,
    };
  }

  /**
   * Update workspace details (name, description, avatarUrl).
   * Automatically regenerates a unique slug if the workspace name is updated, handling collisions.
   */
  async update(
    workspaceId: string,
    dto: UpdateWorkspaceDto,
  ): Promise<Workspace> {
    const existing = await this.findById(workspaceId);

    if (dto.name && dto.name !== existing.name) {
      let slug = await this.generateUniqueSlug(dto.name);
      let attempts = 0;

      while (attempts < 3) {
        try {
          const updated = await this.workspaceRepo.update(workspaceId, {
            ...dto,
            slug,
          });
          this.logger.log(
            `Workspace updated: ${workspaceId} (new slug: ${slug})`,
          );
          return updated;
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
          ) {
            attempts++;
            slug = await this.generateUniqueSlug(dto.name);
            continue;
          }
          throw error;
        }
      }
      throw new BusinessRuleException(
        'SLUG_COLLISION',
        'Could not generate unique workspace slug, please try again',
      );
    }

    return this.workspaceRepo.update(workspaceId, dto);
  }

  /**
   * Soft-delete a workspace by setting archivedAt.
   */
  async archive(workspaceId: string): Promise<void> {
    await this.findById(workspaceId);
    await this.workspaceRepo.archive(workspaceId);
    this.logger.log(`Workspace archived: ${workspaceId}`);
  }

  /**
   * Check if a user is an active member of a workspace.
   */
  async isUserMember(workspaceId: string, userId: string): Promise<boolean> {
    const member = await this.memberRepo.findMember(workspaceId, userId);
    return !!member;
  }

  /**
   * Helper method to generate a URL-safe unique slug for workspace.
   */
  private async generateUniqueSlug(name: string): Promise<string> {
    const baseSlug =
      name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-') || 'workspace';

    let slug = baseSlug;

    while (await this.workspaceRepo.existsBySlug(slug)) {
      slug = `${baseSlug}-${randomBytes(3).toString('hex')}`;
    }

    return slug;
  }
}
