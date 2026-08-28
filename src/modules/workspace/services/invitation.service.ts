import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import {
  InvitationStatus,
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
import { MembershipService } from './membership.service';
import { AuthService } from '../../auth/services/auth.service';
import { InviteMemberDto } from '../dto/invite-member.dto';
import { AcceptInvitationDto } from '../dto/accept-invitation.dto';
import type { WorkspaceInvitationWithInviter } from '../interfaces/workspace.interfaces';
import {
  WorkspaceInvitationCreatedEvent,
  WorkspaceMemberAddedEvent,
} from '../events/workspace.events';
import { WORKSPACE_EVENTS } from '../events/workspace-events.constants';
import {
  EntityNotFoundException,
  BusinessRuleException,
} from '../../../common/exceptions/app.exception';

/**
 * Workspace invitation lifecycle: invite with hashed tokens and role bounds,
 * listing, single-use acceptance, and revocation.
 */
@Injectable()
export class InvitationService {
  private readonly logger = new Logger(InvitationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceRepo: WorkspaceRepository,
    private readonly memberRepo: WorkspaceMemberRepository,
    private readonly invitationRepo: WorkspaceInvitationRepository,
    private readonly membershipService: MembershipService,
    private readonly authService: AuthService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

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
    await this.membershipService.requireWorkspace(workspaceId);

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
      WORKSPACE_EVENTS.invitationCreated,
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
    await this.membershipService.requireWorkspace(workspaceId);
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
      WORKSPACE_EVENTS.memberAdded,
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
}
