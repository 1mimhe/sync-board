import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import {
  InvitationStatus,
  Workspace,
  WorkspaceMember,
  WorkspaceRole,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { EventEmitter2 } from '@nestjs/event-emitter';
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
    private readonly workspaceRepo: WorkspaceRepository,
    private readonly memberRepo: WorkspaceMemberRepository,
    private readonly invitationRepo: WorkspaceInvitationRepository,
    private readonly authService: AuthService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create a new workspace, generate a unique slug, set creator as OWNER, and emit `workspace.created`.
   */
  async create(dto: CreateWorkspaceDto, userId: string): Promise<Workspace> {
    this.logger.debug(`Creating workspace '${dto.name}' for user ${userId}`);
    const slug = await this.generateUniqueSlug(dto.name);

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
  async findById(workspaceId: string): Promise<Workspace> {
    const workspace = await this.workspaceRepo.findById(workspaceId);
    if (!workspace) {
      throw new EntityNotFoundException('Workspace', workspaceId);
    }
    return workspace;
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
   */
  async update(
    workspaceId: string,
    dto: UpdateWorkspaceDto,
  ): Promise<Workspace> {
    await this.findById(workspaceId);
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
   * @throws EntityNotFoundException if member not found
   * @throws BusinessRuleException CANNOT_REMOVE_OWNER if attempting to demote sole owner
   */
  async updateMemberRole(
    workspaceId: string,
    memberId: string,
    dto: UpdateMemberRoleDto,
  ): Promise<WorkspaceMember> {
    const member = await this.memberRepo.findMemberById(memberId);
    if (!member || member.workspaceId !== workspaceId) {
      throw new EntityNotFoundException('WorkspaceMember', memberId);
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
   * @throws EntityNotFoundException if member not found
   * @throws BusinessRuleException CANNOT_REMOVE_OWNER if member is sole owner
   */
  async removeMember(workspaceId: string, memberId: string): Promise<void> {
    const member = await this.memberRepo.findMemberById(memberId);
    if (!member || member.workspaceId !== workspaceId) {
      throw new EntityNotFoundException('WorkspaceMember', memberId);
    }

    if (member.role === WorkspaceRole.owner) {
      const ownerCount = await this.memberRepo.countOwners(workspaceId);
      if (ownerCount <= 1) {
        throw new BusinessRuleException(
          'CANNOT_REMOVE_OWNER',
          'Cannot remove the sole owner of a workspace',
        );
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
   * Send an invitation to join a workspace via email.
   * @throws BusinessRuleException ALREADY_A_MEMBER or INVITATION_ALREADY_SENT
   */
  async inviteMember(
    workspaceId: string,
    dto: InviteMemberDto,
    invitedBy: string,
  ): Promise<WorkspaceInvitationWithInviter> {
    await this.findById(workspaceId);

    // 1. Check if user with email already exists and is already in workspace
    const existingUser = await this.authService.getUserByEmail(dto.email);
    if (existingUser) {
      const existingMember = await this.memberRepo.findMember(
        workspaceId,
        existingUser.id,
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

    // 3. Generate token & 7-day expiration
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invitation = await this.invitationRepo.createInvitation({
      workspaceId,
      email: dto.email,
      role: dto.role,
      token,
      invitedBy,
      expiresAt,
    });

    this.eventEmitter.emit(
      'workspace.invitation_created',
      new WorkspaceInvitationCreatedEvent(
        workspaceId,
        dto.email,
        invitedBy,
        token,
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
   * @throws BusinessRuleException INVITATION_EXPIRED if token invalid/expired
   */
  async acceptInvitation(
    dto: AcceptInvitationDto,
    userId: string,
  ): Promise<WorkspaceMember> {
    const invitation = await this.invitationRepo.findByToken(dto.token);
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

    const member = await this.memberRepo.createMember(
      invitation.workspaceId,
      userId,
      invitation.role,
    );

    await this.invitationRepo.updateStatus(
      invitation.id,
      InvitationStatus.accepted,
      new Date(),
    );

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
  async generateUniqueSlug(name: string): Promise<string> {
    const baseSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-');

    let slug = baseSlug || 'workspace';
    let counter = 1;

    while (await this.workspaceRepo.findBySlug(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }
}
