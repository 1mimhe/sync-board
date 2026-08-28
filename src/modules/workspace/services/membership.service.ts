import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { WorkspaceMember, WorkspaceRole } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../common/database/prisma.service';
import { WorkspaceRepository } from '../repositories/workspace.repository';
import { WorkspaceMemberRepository } from '../repositories/workspace-member.repository';
import { UpdateMemberRoleDto } from '../dto/update-member-role.dto';
import type { MemberWithUser } from '../interfaces/workspace.interfaces';
import {
  WorkspaceMemberRemovedEvent,
  WorkspaceMemberLeftEvent,
  WorkspaceMemberRoleChangedEvent,
  WorkspaceOwnershipTransferredEvent,
} from '../events/workspace.events';
import { WORKSPACE_EVENTS } from '../events/workspace-events.constants';
import {
  EntityNotFoundException,
  BusinessRuleException,
} from '../../../common/exceptions/app.exception';

/**
 * Workspace membership management: listing members, role changes with
 * admin/owner gating, member removal, self-leave, and ownership transfer.
 */
@Injectable()
export class MembershipService {
  private readonly logger = new Logger(MembershipService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceRepo: WorkspaceRepository,
    private readonly memberRepo: WorkspaceMemberRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Shared workspace-existence guard (moved from the former monolithic service).
   * @throws EntityNotFoundException if workspace not found or archived
   */
  async requireWorkspace(workspaceId: string): Promise<void> {
    const workspace = await this.workspaceRepo.findById(workspaceId);
    if (!workspace) {
      throw new EntityNotFoundException('Workspace', workspaceId);
    }
  }

  /**
   * Get members of a workspace with user summary info.
   */
  async getMembers(workspaceId: string): Promise<MemberWithUser[]> {
    await this.requireWorkspace(workspaceId);
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

      const workspace = await this.workspaceRepo.findById(workspaceId);
      if (workspace && workspace.ownerId === member.userId) {
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
      WORKSPACE_EVENTS.memberRoleChanged,
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

      const workspace = await this.workspaceRepo.findById(workspaceId);
      if (workspace && workspace.ownerId === member.userId) {
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
      WORKSPACE_EVENTS.memberRemoved,
      new WorkspaceMemberRemovedEvent(workspaceId, member.userId),
    );

    this.logger.log(
      `Member ${member.userId} removed from workspace ${workspaceId}`,
    );
  }

  /**
   * Allow current authenticated member to leave a workspace.
   * Sole owner cannot leave without transferring ownership first.
   * @emits workspace.member_left
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

      const workspace = await this.workspaceRepo.findById(workspaceId);
      if (workspace && workspace.ownerId === userId) {
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
      WORKSPACE_EVENTS.memberLeft,
      new WorkspaceMemberLeftEvent(workspaceId, userId),
    );

    this.logger.log(`User ${userId} left workspace ${workspaceId}`);
  }

  /**
   * Transfer workspace ownership to another workspace member.
   * @emits workspace.ownership_transferred
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

    const updatedTarget = await this.prisma.$transaction(async (tx) => {
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

    this.eventEmitter.emit(
      WORKSPACE_EVENTS.ownershipTransferred,
      new WorkspaceOwnershipTransferredEvent(
        workspaceId,
        currentOwnerId,
        newOwnerUserId,
      ),
    );

    return updatedTarget;
  }
}
