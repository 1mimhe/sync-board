import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import {
  InvitationStatus,
  Prisma,
  Workspace,
  WorkspaceMember,
  WorkspaceRole,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../common/database/prisma.service';
import { hashToken } from '../../../common/utils/hash.util';
import { WorkspaceRepository } from '../repositories/workspace.repository';
import { WorkspaceMemberRepository } from '../repositories/workspace-member.repository';
import { WorkspaceInvitationRepository } from '../repositories/workspace-invitation.repository';
import { AuthService } from '../../auth/services/auth.service';
import { CreateWorkspaceDto } from '../dto/create-workspace.dto';
import { UpdateWorkspaceDto } from '../dto/update-workspace.dto';
import { InviteMemberDto } from '../dto/invite-member.dto';
import { UpdateMemberRoleDto } from '../dto/update-member-role.dto';
import { AcceptInvitationDto } from '../dto/accept-invitation.dto';
import {
  WorkspaceWithRole,
  MemberWithUser,
  WorkspaceInvitationWithInviter,
} from '../interfaces/workspace.interfaces';
import {
  WorkspaceCreatedEvent,
  WorkspaceMemberAddedEvent,
  WorkspaceMemberRemovedEvent,
  WorkspaceMemberRoleChangedEvent,
  WorkspaceInvitationCreatedEvent,
} from '../events/workspace.events';
import {
  EntityNotFoundException,
  BusinessRuleException,
} from '../../../common/exceptions/app.exception';

@Injectable()
export class WorkspaceService {
  private readonly logger = new Logger(WorkspaceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceRepo: WorkspaceRepository,
    private readonly memberRepo: WorkspaceMemberRepository,
    private readonly invitationRepo: WorkspaceInvitationRepository,
    private readonly authService: AuthService,
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
          'workspace.created',
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
   * Get members of a workspace with user summary info.
   */
  async getMembers(workspaceId: string): Promise<MemberWithUser[]> {
    await this.findById(workspaceId);
    return this.memberRepo.findMembersWithUser(workspaceId);
  }

  /**
   * Update a member's role in a workspace.
   * Gated so admins cannot modify owners or promote anyone to owner.
   * Automatically reassigns workspace.ownerId if an owner is demoted.
   * @throws EntityNotFoundException if member not found
   * @throws ForbiddenException if admin attempts unauthorized role change
   * @throws BusinessRuleException CANNOT_REMOVE_OWNER if attempting to demote sole owner
   */
  async updateMemberRole(
    workspaceId: string,
    memberId: string,
    dto: UpdateMemberRoleDto,
    actorId?: string,
  ): Promise<WorkspaceMember> {
    const member = await this.memberRepo.findMemberById(memberId);
    if (!member || member.workspaceId !== workspaceId) {
      throw new EntityNotFoundException('WorkspaceMember', memberId);
    }

    if (actorId) {
      const actorMember = await this.memberRepo.findMember(
        workspaceId,
        actorId,
      );
      if (actorMember?.role === WorkspaceRole.admin) {
        if (member.role === WorkspaceRole.owner) {
          throw new ForbiddenException(
            'Admins cannot modify the role of a workspace owner',
          );
        }
        if (dto.role === WorkspaceRole.owner) {
          throw new ForbiddenException(
            'Only workspace owners can promote members to owner',
          );
        }
      }
    }

    if (
      member.role === WorkspaceRole.owner &&
      dto.role !== WorkspaceRole.owner
    ) {
      const ownerCount = await this.memberRepo.countOwners(workspaceId);
      if (ownerCount <= 1) {
        throw new BusinessRuleException(
          'CANNOT_REMOVE_OWNER',
          'Cannot demote the sole owner of a workspace',
        );
      }

      const workspace = await this.findById(workspaceId);
      if (workspace.ownerId === member.userId) {
        const nextOwner = await this.memberRepo.findOtherOwner(
          workspaceId,
          member.userId,
        );
        if (nextOwner) {
          await this.workspaceRepo.update(workspaceId, {
            owner: { connect: { id: nextOwner.userId } },
          });
        }
      }
    }

    const oldRole = member.role;
    const updatedMember = await this.memberRepo.updateRole(memberId, dto.role);

    this.eventEmitter.emit(
      'workspace.member_role_changed',
      new WorkspaceMemberRoleChangedEvent(
        workspaceId,
        member.userId,
        oldRole,
        dto.role,
      ),
    );

    this.logger.log(
      `Member ${member.userId} role changed from ${oldRole} to ${dto.role} in workspace ${workspaceId}`,
    );

    return updatedMember;
  }

  /**
   * Remove a member from a workspace.
   * Gated so admins cannot remove owners.
   * Automatically reassigns workspace.ownerId if an owner is removed.
   * @throws EntityNotFoundException if member not found
   * @throws ForbiddenException if admin attempts to remove an owner
   * @throws BusinessRuleException CANNOT_REMOVE_OWNER if member is sole owner
   */
  async removeMember(
    workspaceId: string,
    memberId: string,
    actorId?: string,
  ): Promise<void> {
    const member = await this.memberRepo.findMemberById(memberId);
    if (!member || member.workspaceId !== workspaceId) {
      throw new EntityNotFoundException('WorkspaceMember', memberId);
    }

    if (actorId) {
      const actorMember = await this.memberRepo.findMember(
        workspaceId,
        actorId,
      );
      if (
        actorMember?.role === WorkspaceRole.admin &&
        member.role === WorkspaceRole.owner
      ) {
        throw new ForbiddenException('Admins cannot remove a workspace owner');
      }
    }

    if (member.role === WorkspaceRole.owner) {
      const ownerCount = await this.memberRepo.countOwners(workspaceId);
      if (ownerCount <= 1) {
        throw new BusinessRuleException(
          'CANNOT_REMOVE_OWNER',
          'Cannot remove the sole owner of a workspace',
        );
      }

      const workspace = await this.findById(workspaceId);
      if (workspace.ownerId === member.userId) {
        const nextOwner = await this.memberRepo.findOtherOwner(
          workspaceId,
          member.userId,
        );
        if (nextOwner) {
          await this.workspaceRepo.update(workspaceId, {
            owner: { connect: { id: nextOwner.userId } },
          });
        }
      }
    }

    await this.memberRepo.removeMember(memberId);

    this.eventEmitter.emit(
      'workspace.member_removed',
      new WorkspaceMemberRemovedEvent(workspaceId, member.userId),
    );

    this.logger.log(
      `Member ${member.userId} removed from workspace ${workspaceId}`,
    );
  }

  /**
   * Allow current authenticated member to leave a workspace.
   * Sole owner cannot leave without transferring ownership first.
   */
  async leaveWorkspace(workspaceId: string, userId: string): Promise<void> {
    const member = await this.memberRepo.findMember(workspaceId, userId);
    if (!member) {
      throw new EntityNotFoundException('WorkspaceMember', userId);
    }

    if (member.role === WorkspaceRole.owner) {
      const ownerCount = await this.memberRepo.countOwners(workspaceId);
      if (ownerCount <= 1) {
        throw new BusinessRuleException(
          'CANNOT_LEAVE_AS_SOLE_OWNER',
          'Sole owner must transfer ownership before leaving the workspace',
        );
      }

      const workspace = await this.findById(workspaceId);
      if (workspace.ownerId === userId) {
        const nextOwner = await this.memberRepo.findOtherOwner(
          workspaceId,
          userId,
        );
        if (nextOwner) {
          await this.workspaceRepo.update(workspaceId, {
            owner: { connect: { id: nextOwner.userId } },
          });
        }
      }
    }

    await this.memberRepo.removeMember(member.id);

    this.eventEmitter.emit(
      'workspace.member_removed',
      new WorkspaceMemberRemovedEvent(workspaceId, userId),
    );

    this.logger.log(`User ${userId} left workspace ${workspaceId}`);
  }

  /**
   * Transfer workspace ownership to another workspace member.
   */
  async transferOwnership(
    workspaceId: string,
    currentOwnerId: string,
    newOwnerUserId: string,
  ): Promise<WorkspaceMember> {
    const currentMember = await this.memberRepo.findMember(
      workspaceId,
      currentOwnerId,
    );
    if (currentMember?.role !== WorkspaceRole.owner) {
      throw new ForbiddenException(
        'Only current workspace owner can transfer ownership',
      );
    }

    const targetMember = await this.memberRepo.findMember(
      workspaceId,
      newOwnerUserId,
    );
    if (!targetMember) {
      throw new BusinessRuleException(
        'TARGET_NOT_MEMBER',
        'Target user must be an active member of this workspace',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.workspaceMember.update({
        where: { id: currentMember.id },
        data: { role: WorkspaceRole.admin },
      });

      const updatedTarget = await tx.workspaceMember.update({
        where: { id: targetMember.id },
        data: { role: WorkspaceRole.owner },
      });

      await tx.workspace.update({
        where: { id: workspaceId },
        data: { owner: { connect: { id: newOwnerUserId } } },
      });

      return updatedTarget;
    });
  }

  /**
   * Send an invitation to join a workspace via email.
   * Enforces role bounds (admin can only invite member/viewer) and stores SHA-256 hashed tokens in DB.
   * @throws BusinessRuleException ALREADY_A_MEMBER or INVITATION_ALREADY_SENT
   * @throws ForbiddenException if admin attempts to invite owner/admin
   */
  async inviteMember(
    workspaceId: string,
    dto: InviteMemberDto,
    invitedBy: string,
  ): Promise<WorkspaceInvitationWithInviter> {
    await this.findById(workspaceId);

    const inviterMember = await this.memberRepo.findMember(
      workspaceId,
      invitedBy,
    );
    if (inviterMember?.role === WorkspaceRole.admin) {
      if (
        dto.role === WorkspaceRole.owner ||
        dto.role === WorkspaceRole.admin
      ) {
        throw new ForbiddenException(
          'Admins can only invite members with role member or viewer',
        );
      }
    }

    // 1. Check if user with email already exists and is already in workspace
    const existingUserSummary = await this.authService.findUserSummaryByEmail(
      dto.email,
    );
    if (existingUserSummary) {
      const existingMember = await this.memberRepo.findMember(
        workspaceId,
        existingUserSummary.id,
      );
      if (existingMember) {
        throw new BusinessRuleException(
          'ALREADY_A_MEMBER',
          'User with this email is already a member of this workspace',
        );
      }
    }

    // 2. Check for active pending invitation
    const activeInvite =
      await this.invitationRepo.findPendingByEmailAndWorkspace(
        dto.email,
        workspaceId,
      );
    if (activeInvite) {
      throw new BusinessRuleException(
        'INVITATION_ALREADY_SENT',
        'An active pending invitation has already been sent to this email',
      );
    }

    // 3. Generate raw token & hash for DB storage
    const rawToken = randomBytes(32).toString('hex');
    const hashedToken = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invitation = await this.invitationRepo.createInvitation({
      workspaceId,
      email: dto.email,
      role: dto.role,
      token: hashedToken,
      invitedBy,
      expiresAt,
    });

    this.eventEmitter.emit(
      'workspace.invitation_created',
      new WorkspaceInvitationCreatedEvent(
        workspaceId,
        dto.email,
        invitedBy,
        rawToken,
      ),
    );

    this.logger.log(
      `Invitation sent to ${dto.email} for workspace ${workspaceId}`,
    );

    const inviterUser = await this.authService.getProfile(invitedBy);

    return {
      ...invitation,
      inviter: {
        id: inviterUser.id,
        displayName: inviterUser.displayName,
        email: inviterUser.email,
        avatarUrl: inviterUser.avatarUrl,
      },
    };
  }

  /**
   * Get pending invitations for a workspace.
   */
  async getInvitations(
    workspaceId: string,
  ): Promise<WorkspaceInvitationWithInviter[]> {
    await this.findById(workspaceId);
    return this.invitationRepo.findWorkspaceInvitations(workspaceId);
  }

  /**
   * Accept an invitation using token and add user as workspace member.
   * Enforces strictly matching email address, active workspace state, and atomic transaction.
   * @throws BusinessRuleException INVITATION_EXPIRED, INVITATION_EMAIL_MISMATCH, or ALREADY_A_MEMBER
   */
  async acceptInvitation(
    dto: AcceptInvitationDto,
    userId: string,
  ): Promise<WorkspaceMember> {
    const hashedToken = hashToken(dto.token);
    const invitation = await this.invitationRepo.findByToken(hashedToken);
    if (
      !invitation ||
      invitation.status !== 'pending' ||
      invitation.expiresAt < new Date()
    ) {
      throw new BusinessRuleException(
        'INVITATION_EXPIRED',
        'Invitation token is invalid, expired, or revoked',
      );
    }

    const workspace = await this.workspaceRepo.findById(invitation.workspaceId);
    if (!workspace) {
      throw new BusinessRuleException(
        'INVITATION_EXPIRED',
        'Target workspace is archived or no longer available',
      );
    }

    const userProfile = await this.authService.getProfile(userId);
    if (invitation.email.toLowerCase() !== userProfile.email.toLowerCase()) {
      throw new BusinessRuleException(
        'INVITATION_EMAIL_MISMATCH',
        'This invitation was issued to a different email address',
      );
    }

    // Check if user is already a member
    const existingMember = await this.memberRepo.findMember(
      invitation.workspaceId,
      userId,
    );

    if (existingMember) {
      throw new BusinessRuleException(
        'ALREADY_A_MEMBER',
        'User is already a member of this workspace',
      );
    }

    const member = await this.prisma.$transaction(async (tx) => {
      const createdMember = await tx.workspaceMember.create({
        data: {
          workspaceId: invitation.workspaceId,
          userId,
          role: invitation.role,
        },
      });

      await tx.workspaceInvitation.update({
        where: { id: invitation.id },
        data: {
          status: InvitationStatus.accepted,
          acceptedAt: new Date(),
        },
      });

      return createdMember;
    });

    this.eventEmitter.emit(
      'workspace.member_added',
      new WorkspaceMemberAddedEvent(
        invitation.workspaceId,
        userId,
        invitation.role,
      ),
    );

    this.logger.log(
      `User ${userId} accepted invitation and joined workspace ${invitation.workspaceId} as ${invitation.role}`,
    );

    return member;
  }

  /**
   * Revoke a pending invitation.
   * @throws EntityNotFoundException if invitation not found
   */
  async revokeInvitation(
    workspaceId: string,
    invitationId: string,
  ): Promise<void> {
    const invitation = await this.invitationRepo.findById(invitationId);
    if (
      !invitation ||
      invitation.workspaceId !== workspaceId ||
      invitation.status !== 'pending'
    ) {
      throw new EntityNotFoundException('WorkspaceInvitation', invitationId);
    }

    await this.invitationRepo.updateStatus(
      invitationId,
      InvitationStatus.revoked,
    );
    this.logger.log(
      `Invitation ${invitationId} revoked for workspace ${workspaceId}`,
    );
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

    while (await this.workspaceRepo.findBySlug(slug)) {
      slug = `${baseSlug}-${randomBytes(3).toString('hex')}`;
    }

    return slug;
  }
}
