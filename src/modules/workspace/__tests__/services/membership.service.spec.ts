import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { ForbiddenException } from '@nestjs/common';
import { WorkspaceRole } from '@prisma/client';
import { MembershipService } from '../../services/membership.service';
import { WorkspaceRepository } from '../../repositories/workspace.repository';
import { WorkspaceMemberRepository } from '../../repositories/workspace-member.repository';
import { PrismaService } from '../../../../common/database/prisma.service';
import {
  EntityNotFoundException,
  BusinessRuleException,
} from '../../../../common/exceptions/app.exception';

describe('MembershipService', () => {
  let service: MembershipService;
  let workspaceRepo: DeepMockProxy<WorkspaceRepository>;
  let memberRepo: DeepMockProxy<WorkspaceMemberRepository>;
  let prismaMock: {
    $transaction: jest.Mock;
    workspace: { update: jest.Mock };
    workspaceMember: { update: jest.Mock };
  };
  let eventEmitter: DeepMockProxy<EventEmitter2>;

  beforeEach(async () => {
    workspaceRepo = mockDeep<WorkspaceRepository>();
    memberRepo = mockDeep<WorkspaceMemberRepository>();
    eventEmitter = mockDeep<EventEmitter2>();

    prismaMock = {
      $transaction: jest.fn().mockImplementation((cb) => cb(prismaMock)),
      workspace: {
        update: jest.fn(),
      },
      workspaceMember: {
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembershipService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: WorkspaceRepository, useValue: workspaceRepo },
        { provide: WorkspaceMemberRepository, useValue: memberRepo },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<MembershipService>(MembershipService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('requireWorkspace', () => {
    it('should pass when workspace exists', async () => {
      workspaceRepo.findById.mockResolvedValue({ id: 'ws-1' } as any);

      await expect(service.requireWorkspace('ws-1')).resolves.toBeUndefined();
    });

    it('should throw EntityNotFoundException when workspace not found', async () => {
      workspaceRepo.findById.mockResolvedValue(null);

      await expect(service.requireWorkspace('ws-missing')).rejects.toThrow(
        EntityNotFoundException,
      );
    });
  });

  describe('getMembers', () => {
    it('should return members with user summary', async () => {
      workspaceRepo.findById.mockResolvedValue({ id: 'ws-1' } as any);
      const mockMembers = [{ id: 'm-1', userId: 'u-1', role: WorkspaceRole.owner }];
      memberRepo.findMembersWithUser.mockResolvedValue(mockMembers as any);

      const result = await service.getMembers('ws-1');

      expect(result).toEqual(mockMembers);
      expect(memberRepo.findMembersWithUser).toHaveBeenCalledWith('ws-1');
    });

    it('should throw EntityNotFoundException when workspace does not exist', async () => {
      workspaceRepo.findById.mockResolvedValue(null);

      await expect(service.getMembers('ws-missing')).rejects.toThrow(
        EntityNotFoundException,
      );
    });
  });

  describe('updateMemberRole', () => {
    it('should throw EntityNotFoundException if member not found or wrong workspace', async () => {
      memberRepo.findMemberById.mockResolvedValue(null);

      await expect(
        service.updateMemberRole('ws-1', 'm-99', { role: WorkspaceRole.admin }),
      ).rejects.toThrow(EntityNotFoundException);
    });

    it('should throw ForbiddenException if admin attempts to modify owner role', async () => {
      const mockMember = { id: 'm-1', workspaceId: 'ws-1', userId: 'u-owner', role: WorkspaceRole.owner };
      memberRepo.findMemberById.mockResolvedValue(mockMember as any);
      memberRepo.findMember.mockResolvedValue({ role: WorkspaceRole.admin } as any);

      await expect(
        service.updateMemberRole('ws-1', 'm-1', { role: WorkspaceRole.member }, 'u-admin'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if admin attempts to promote member to owner', async () => {
      const mockMember = { id: 'm-1', workspaceId: 'ws-1', userId: 'u-member', role: WorkspaceRole.member };
      memberRepo.findMemberById.mockResolvedValue(mockMember as any);
      memberRepo.findMember.mockResolvedValue({ role: WorkspaceRole.admin } as any);

      await expect(
        service.updateMemberRole('ws-1', 'm-1', { role: WorkspaceRole.owner }, 'u-admin'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow owner to change roles without admin gating', async () => {
      const mockMember = { id: 'm-1', workspaceId: 'ws-1', userId: 'u-member', role: WorkspaceRole.member };
      memberRepo.findMemberById.mockResolvedValue(mockMember as any);
      memberRepo.findMember.mockResolvedValue({ role: WorkspaceRole.owner } as any);
      memberRepo.updateRole.mockResolvedValue({ ...mockMember, role: WorkspaceRole.admin } as any);

      const res = await service.updateMemberRole(
        'ws-1',
        'm-1',
        { role: WorkspaceRole.admin },
        'u-owner',
      );

      expect(res.role).toBe(WorkspaceRole.admin);
    });

    it('should allow admin to change a regular member role', async () => {
      const mockMember = { id: 'm-1', workspaceId: 'ws-1', userId: 'u-member', role: WorkspaceRole.member };
      memberRepo.findMemberById.mockResolvedValue(mockMember as any);
      memberRepo.findMember.mockResolvedValue({ role: WorkspaceRole.admin } as any);
      memberRepo.updateRole.mockResolvedValue({ ...mockMember, role: WorkspaceRole.viewer } as any);

      const res = await service.updateMemberRole(
        'ws-1',
        'm-1',
        { role: WorkspaceRole.viewer },
        'u-admin',
      );

      expect(res.role).toBe(WorkspaceRole.viewer);
    });

    it('should skip ownerId reassignment when demoted owner is not the workspace ownerId', async () => {
      const mockMember = {
        id: 'm-1',
        workspaceId: 'ws-1',
        userId: 'user-1',
        role: WorkspaceRole.owner,
      };
      memberRepo.findMemberById.mockResolvedValue(mockMember as any);
      memberRepo.countOwners.mockResolvedValue(2);
      workspaceRepo.findById.mockResolvedValue({ id: 'ws-1', ownerId: 'someone-else' } as any);
      memberRepo.updateRole.mockResolvedValue({ ...mockMember, role: WorkspaceRole.admin } as any);

      await service.updateMemberRole('ws-1', 'm-1', { role: WorkspaceRole.admin });

      expect(workspaceRepo.update).not.toHaveBeenCalled();
      expect(memberRepo.findOtherOwner).not.toHaveBeenCalled();
    });

    it('should not reassign ownerId when no other owner candidate exists during demotion', async () => {
      const mockMember = {
        id: 'm-1',
        workspaceId: 'ws-1',
        userId: 'user-1',
        role: WorkspaceRole.owner,
      };
      memberRepo.findMemberById.mockResolvedValue(mockMember as any);
      memberRepo.countOwners.mockResolvedValue(2);
      workspaceRepo.findById.mockResolvedValue({ id: 'ws-1', ownerId: 'user-1' } as any);
      memberRepo.findOtherOwner.mockResolvedValue(null);
      memberRepo.updateRole.mockResolvedValue({ ...mockMember, role: WorkspaceRole.admin } as any);

      await service.updateMemberRole('ws-1', 'm-1', { role: WorkspaceRole.admin });

      expect(workspaceRepo.update).not.toHaveBeenCalled();
    });

    it('should throw BusinessRuleException CANNOT_REMOVE_OWNER if demoting sole owner', async () => {
      const mockMember = {
        id: 'm-1',
        workspaceId: 'ws-1',
        userId: 'user-1',
        role: WorkspaceRole.owner,
      };

      memberRepo.findMemberById.mockResolvedValue(mockMember as any);
      memberRepo.countOwners.mockResolvedValue(1);

      await expect(
        service.updateMemberRole('ws-1', 'm-1', { role: WorkspaceRole.member }),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should demote owner and reassign workspace.ownerId when other owner exists', async () => {
      const mockMember = {
        id: 'm-1',
        workspaceId: 'ws-1',
        userId: 'user-1',
        role: WorkspaceRole.owner,
      };
      const otherOwner = {
        id: 'm-2',
        workspaceId: 'ws-1',
        userId: 'user-2',
        role: WorkspaceRole.owner,
      };

      memberRepo.findMemberById.mockResolvedValue(mockMember as any);
      memberRepo.countOwners.mockResolvedValue(2);
      workspaceRepo.findById.mockResolvedValue({ id: 'ws-1', ownerId: 'user-1' } as any);
      memberRepo.findOtherOwner.mockResolvedValue(otherOwner as any);
      memberRepo.updateRole.mockResolvedValue({ ...mockMember, role: WorkspaceRole.admin } as any);

      const res = await service.updateMemberRole('ws-1', 'm-1', { role: WorkspaceRole.admin });

      expect(workspaceRepo.update).toHaveBeenCalledWith('ws-1', {
        owner: { connect: { id: 'user-2' } },
      });
      expect(res.role).toBe(WorkspaceRole.admin);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'workspace.member_role_changed',
        expect.anything(),
      );
    });

    it('should emit member_role_changed with old and new roles', async () => {
      const mockMember = { id: 'm-1', workspaceId: 'ws-1', userId: 'u-1', role: WorkspaceRole.member };
      memberRepo.findMemberById.mockResolvedValue(mockMember as any);
      memberRepo.updateRole.mockResolvedValue({ ...mockMember, role: WorkspaceRole.admin } as any);

      await service.updateMemberRole('ws-1', 'm-1', { role: WorkspaceRole.admin });

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'workspace.member_role_changed',
        expect.anything(),
      );
    });
  });

  describe('removeMember', () => {
    it('should throw EntityNotFoundException if member not found or wrong workspace', async () => {
      memberRepo.findMemberById.mockResolvedValue({ id: 'm-1', workspaceId: 'ws-other' } as any);

      await expect(service.removeMember('ws-1', 'm-1')).rejects.toThrow(EntityNotFoundException);
    });

    it('should throw ForbiddenException if admin attempts to remove an owner', async () => {
      memberRepo.findMemberById.mockResolvedValue({ id: 'm-1', workspaceId: 'ws-1', role: WorkspaceRole.owner } as any);
      memberRepo.findMember.mockResolvedValue({ role: WorkspaceRole.admin } as any);

      await expect(service.removeMember('ws-1', 'm-1', 'admin-id')).rejects.toThrow(ForbiddenException);
    });

    it('should throw BusinessRuleException if attempting to remove sole owner', async () => {
      memberRepo.findMemberById.mockResolvedValue({ id: 'm-1', workspaceId: 'ws-1', role: WorkspaceRole.owner } as any);
      memberRepo.countOwners.mockResolvedValue(1);

      await expect(service.removeMember('ws-1', 'm-1')).rejects.toThrow(BusinessRuleException);
    });

    it('should remove owner and reassign ownerId if other owner exists', async () => {
      memberRepo.findMemberById.mockResolvedValue({ id: 'm-1', workspaceId: 'ws-1', userId: 'u-1', role: WorkspaceRole.owner } as any);
      memberRepo.countOwners.mockResolvedValue(2);
      workspaceRepo.findById.mockResolvedValue({ id: 'ws-1', ownerId: 'u-1' } as any);
      memberRepo.findOtherOwner.mockResolvedValue({ userId: 'u-2' } as any);

      await service.removeMember('ws-1', 'm-1');

      expect(workspaceRepo.update).toHaveBeenCalledWith('ws-1', {
        owner: { connect: { id: 'u-2' } },
      });
      expect(memberRepo.removeMember).toHaveBeenCalledWith('m-1');
      expect(eventEmitter.emit).toHaveBeenCalledWith('workspace.member_removed', expect.anything());
    });

    it('should allow admin to remove a regular member', async () => {
      memberRepo.findMemberById.mockResolvedValue({ id: 'm-1', workspaceId: 'ws-1', userId: 'u-1', role: WorkspaceRole.member } as any);
      memberRepo.findMember.mockResolvedValue({ role: WorkspaceRole.admin } as any);

      await service.removeMember('ws-1', 'm-1', 'admin-id');

      expect(memberRepo.removeMember).toHaveBeenCalledWith('m-1');
    });

    it('should skip ownerId reassignment when removed owner is not the workspace ownerId', async () => {
      memberRepo.findMemberById.mockResolvedValue({ id: 'm-1', workspaceId: 'ws-1', userId: 'u-1', role: WorkspaceRole.owner } as any);
      memberRepo.countOwners.mockResolvedValue(2);
      workspaceRepo.findById.mockResolvedValue({ id: 'ws-1', ownerId: 'u-other' } as any);

      await service.removeMember('ws-1', 'm-1');

      expect(workspaceRepo.update).not.toHaveBeenCalled();
      expect(memberRepo.removeMember).toHaveBeenCalledWith('m-1');
    });

    it('should not reassign ownerId when no other owner candidate exists during removal', async () => {
      memberRepo.findMemberById.mockResolvedValue({ id: 'm-1', workspaceId: 'ws-1', userId: 'u-1', role: WorkspaceRole.owner } as any);
      memberRepo.countOwners.mockResolvedValue(2);
      workspaceRepo.findById.mockResolvedValue({ id: 'ws-1', ownerId: 'u-1' } as any);
      memberRepo.findOtherOwner.mockResolvedValue(null);

      await service.removeMember('ws-1', 'm-1');

      expect(workspaceRepo.update).not.toHaveBeenCalled();
      expect(memberRepo.removeMember).toHaveBeenCalledWith('m-1');
    });

    it('should remove a regular member without owner reassignment', async () => {
      memberRepo.findMemberById.mockResolvedValue({ id: 'm-1', workspaceId: 'ws-1', userId: 'u-1', role: WorkspaceRole.member } as any);

      await service.removeMember('ws-1', 'm-1');

      expect(workspaceRepo.update).not.toHaveBeenCalled();
      expect(memberRepo.removeMember).toHaveBeenCalledWith('m-1');
      expect(eventEmitter.emit).toHaveBeenCalledWith('workspace.member_removed', expect.anything());
    });
  });

  describe('leaveWorkspace', () => {
    it('should throw EntityNotFoundException if user is not a member', async () => {
      memberRepo.findMember.mockResolvedValue(null);

      await expect(service.leaveWorkspace('ws-1', 'u-stranger')).rejects.toThrow(EntityNotFoundException);
    });

    it('should throw BusinessRuleException if sole owner attempts to leave', async () => {
      memberRepo.findMember.mockResolvedValue({ id: 'm-1', role: WorkspaceRole.owner } as any);
      memberRepo.countOwners.mockResolvedValue(1);

      await expect(service.leaveWorkspace('ws-1', 'u-owner')).rejects.toThrow(BusinessRuleException);
    });

    it('should allow owner to leave if other owner exists and reassign ownerId', async () => {
      memberRepo.findMember.mockResolvedValue({ id: 'm-1', role: WorkspaceRole.owner, userId: 'u-owner' } as any);
      memberRepo.countOwners.mockResolvedValue(2);
      workspaceRepo.findById.mockResolvedValue({ id: 'ws-1', ownerId: 'u-owner' } as any);
      memberRepo.findOtherOwner.mockResolvedValue({ userId: 'u-other-owner' } as any);

      await service.leaveWorkspace('ws-1', 'u-owner');

      expect(workspaceRepo.update).toHaveBeenCalledWith('ws-1', {
        owner: { connect: { id: 'u-other-owner' } },
      });
      expect(memberRepo.removeMember).toHaveBeenCalledWith('m-1');
      expect(eventEmitter.emit).toHaveBeenCalledWith('workspace.member_removed', expect.anything());
    });

    it('should skip ownerId reassignment when leaving owner is not the workspace ownerId', async () => {
      memberRepo.findMember.mockResolvedValue({ id: 'm-1', role: WorkspaceRole.owner, userId: 'u-owner' } as any);
      memberRepo.countOwners.mockResolvedValue(2);
      workspaceRepo.findById.mockResolvedValue({ id: 'ws-1', ownerId: 'someone-else' } as any);

      await service.leaveWorkspace('ws-1', 'u-owner');

      expect(workspaceRepo.update).not.toHaveBeenCalled();
      expect(memberRepo.removeMember).toHaveBeenCalledWith('m-1');
    });

    it('should not reassign ownerId when no other owner candidate exists during leave', async () => {
      memberRepo.findMember.mockResolvedValue({ id: 'm-1', role: WorkspaceRole.owner, userId: 'u-owner' } as any);
      memberRepo.countOwners.mockResolvedValue(2);
      workspaceRepo.findById.mockResolvedValue({ id: 'ws-1', ownerId: 'u-owner' } as any);
      memberRepo.findOtherOwner.mockResolvedValue(null);

      await service.leaveWorkspace('ws-1', 'u-owner');

      expect(workspaceRepo.update).not.toHaveBeenCalled();
      expect(memberRepo.removeMember).toHaveBeenCalledWith('m-1');
    });

    it('should remove a regular member who leaves', async () => {
      memberRepo.findMember.mockResolvedValue({ id: 'm-1', role: WorkspaceRole.member, userId: 'u-member' } as any);

      await service.leaveWorkspace('ws-1', 'u-member');

      expect(memberRepo.removeMember).toHaveBeenCalledWith('m-1');
      expect(eventEmitter.emit).toHaveBeenCalledWith('workspace.member_removed', expect.anything());
    });
  });

  describe('transferOwnership', () => {
    it('should throw ForbiddenException if current user is not owner', async () => {
      memberRepo.findMember.mockResolvedValueOnce({ id: 'm-1', role: WorkspaceRole.admin } as any);

      await expect(service.transferOwnership('ws-1', 'u-admin', 'u-target')).rejects.toThrow(ForbiddenException);
    });

    it('should throw BusinessRuleException if target user is not a member', async () => {
      memberRepo.findMember
        .mockResolvedValueOnce({ id: 'm-1', role: WorkspaceRole.owner } as any)
        .mockResolvedValueOnce(null);

      await expect(service.transferOwnership('ws-1', 'u-owner', 'u-stranger')).rejects.toThrow(BusinessRuleException);
    });

    it('should transfer ownership in transaction', async () => {
      const ownerMember = { id: 'm-1', role: WorkspaceRole.owner };
      const targetMember = { id: 'm-2', role: WorkspaceRole.member };

      memberRepo.findMember
        .mockResolvedValueOnce(ownerMember as any)
        .mockResolvedValueOnce(targetMember as any);

      prismaMock.workspaceMember.update
        .mockResolvedValueOnce({ ...ownerMember, role: WorkspaceRole.admin })
        .mockResolvedValueOnce({ ...targetMember, role: WorkspaceRole.owner });

      const result = await service.transferOwnership('ws-1', 'u-owner', 'u-target');

      expect(result.role).toBe(WorkspaceRole.owner);
      expect(prismaMock.workspace.update).toHaveBeenCalledWith({
        where: { id: 'ws-1' },
        data: { owner: { connect: { id: 'u-target' } } },
      });
    });
  });
});
