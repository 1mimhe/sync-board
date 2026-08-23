import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { WorkspaceService } from '../../services/workspace.service';
import { WorkspaceRepository } from '../../repositories/workspace.repository';
import { WorkspaceMemberRepository } from '../../repositories/workspace-member.repository';
import { WorkspaceInvitationRepository } from '../../repositories/workspace-invitation.repository';
import { AuthService } from '../../../auth/services/auth.service';
import { PrismaService } from '../../../../common/database/prisma.service';
import { WorkspaceRole, InvitationStatus, Prisma } from '@prisma/client';
import {
  EntityNotFoundException,
  BusinessRuleException,
} from '../../../../common/exceptions/app.exception';
import { ForbiddenException } from '@nestjs/common';

describe('WorkspaceService', () => {
  let service: WorkspaceService;
  let workspaceRepo: DeepMockProxy<WorkspaceRepository>;
  let memberRepo: DeepMockProxy<WorkspaceMemberRepository>;
  let invitationRepo: DeepMockProxy<WorkspaceInvitationRepository>;
  let authService: DeepMockProxy<AuthService>;
  let prismaMock: any;
  let eventEmitter: DeepMockProxy<EventEmitter2>;

  beforeEach(async () => {
    workspaceRepo = mockDeep<WorkspaceRepository>();
    memberRepo = mockDeep<WorkspaceMemberRepository>();
    invitationRepo = mockDeep<WorkspaceInvitationRepository>();
    authService = mockDeep<AuthService>();
    eventEmitter = mockDeep<EventEmitter2>();

    prismaMock = {
      $transaction: jest.fn().mockImplementation((cb) => cb(prismaMock)),
      workspace: {
        update: jest.fn(),
      },
      workspaceMember: {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      workspaceInvitation: {
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceService,
        { provide: WorkspaceRepository, useValue: workspaceRepo },
        { provide: WorkspaceMemberRepository, useValue: memberRepo },
        { provide: WorkspaceInvitationRepository, useValue: invitationRepo },
        { provide: AuthService, useValue: authService },
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<WorkspaceService>(WorkspaceService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('create', () => {
    it('should create workspace with generated slug and emit event', async () => {
      workspaceRepo.existsBySlug.mockResolvedValue(false);
      const mockWorkspace = {
        id: 'ws-1',
        name: 'Engineering',
        slug: 'engineering',
        ownerId: 'user-1',
      };
      workspaceRepo.createWorkspaceWithOwner.mockResolvedValue(mockWorkspace as any);

      const result = await service.create({ name: 'Engineering' }, 'user-1');

      expect(result).toEqual(mockWorkspace);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'workspace.created',
        expect.anything(),
      );
    });

    it('should retry on P2002 error during create and succeed on second attempt', async () => {
      const p2002Error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
      });
      workspaceRepo.existsBySlug.mockResolvedValue(false);
      const mockWorkspace = { id: 'ws-1', name: 'Eng', slug: 'eng' };
      workspaceRepo.createWorkspaceWithOwner
        .mockRejectedValueOnce(p2002Error)
        .mockResolvedValueOnce(mockWorkspace as any);

      const res = await service.create({ name: 'Eng' }, 'u-1');
      expect(res).toEqual(mockWorkspace);
    });

    it('should throw BusinessRuleException SLUG_COLLISION if create fails 3 times with P2002', async () => {
      const p2002Error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
      });
      workspaceRepo.existsBySlug.mockResolvedValue(false);
      workspaceRepo.createWorkspaceWithOwner.mockRejectedValue(p2002Error);

      await expect(service.create({ name: 'Eng' }, 'u-1')).rejects.toThrow(BusinessRuleException);
    });

    it('should rethrow non-P2002 errors during create', async () => {
      workspaceRepo.existsBySlug.mockResolvedValue(false);
      workspaceRepo.createWorkspaceWithOwner.mockRejectedValue(new Error('DB failure'));

      await expect(service.create({ name: 'Eng' }, 'u-1')).rejects.toThrow('DB failure');
    });
  });

  describe('findAllForUser', () => {
    it('should return workspaces for user', async () => {
      const mockList = [{ id: 'ws-1', name: 'WS 1', role: WorkspaceRole.owner }];
      workspaceRepo.findUserWorkspaces.mockResolvedValue(mockList as any);

      const res = await service.findAllForUser('user-1');
      expect(res).toEqual(mockList);
    });
  });

  describe('findByIdWithRole', () => {
    it('should throw EntityNotFoundException when workspace not found', async () => {
      workspaceRepo.findById.mockResolvedValue(null);

      await expect(service.findByIdWithRole('ws-1', 'user-1')).rejects.toThrow(
        EntityNotFoundException,
      );
    });

    it('should throw ForbiddenException if user is not member', async () => {
      workspaceRepo.findById.mockResolvedValue({ id: 'ws-1', name: 'WS 1' } as any);
      memberRepo.findMember.mockResolvedValue(null);

      await expect(service.findByIdWithRole('ws-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });

    it('should return workspace with user role', async () => {
      workspaceRepo.findById.mockResolvedValue({ id: 'ws-1', name: 'WS 1' } as any);
      memberRepo.findMember.mockResolvedValue({ role: WorkspaceRole.admin } as any);

      const res = await service.findByIdWithRole('ws-1', 'user-1');
      expect(res).toEqual({ id: 'ws-1', name: 'WS 1', role: WorkspaceRole.admin });
    });
  });

  describe('findBySlug', () => {
    it('should throw EntityNotFoundException when slug not found', async () => {
      workspaceRepo.findBySlug.mockResolvedValue(null);

      await expect(service.findBySlug('invalid-slug', 'user-1')).rejects.toThrow(
        EntityNotFoundException,
      );
    });

    it('should throw ForbiddenException if user is not member of slug workspace', async () => {
      workspaceRepo.findBySlug.mockResolvedValue({ id: 'ws-1', slug: 'my-slug' } as any);
      memberRepo.findMember.mockResolvedValue(null);

      await expect(service.findBySlug('my-slug', 'user-1')).rejects.toThrow(ForbiddenException);
    });

    it('should return workspace and role when found', async () => {
      workspaceRepo.findBySlug.mockResolvedValue({ id: 'ws-1', slug: 'my-slug' } as any);
      memberRepo.findMember.mockResolvedValue({ role: WorkspaceRole.owner } as any);

      const res = await service.findBySlug('my-slug', 'user-1');
      expect(res).toEqual({ id: 'ws-1', slug: 'my-slug', role: WorkspaceRole.owner });
    });
  });

  describe('update', () => {
    it('should update workspace without changing name', async () => {
      workspaceRepo.findById.mockResolvedValue({ id: 'ws-1', name: 'Old' } as any);
      const updatedWs = { id: 'ws-1', name: 'Old', description: 'Updated desc' };
      workspaceRepo.update.mockResolvedValue(updatedWs as any);

      const res = await service.update('ws-1', {
        description: 'Updated desc',
      });
      expect(res).toEqual(updatedWs);
    });

    it('should update workspace with new name and new slug', async () => {
      workspaceRepo.findById.mockResolvedValue({ id: 'ws-1', name: 'Old Name' } as any);
      workspaceRepo.existsBySlug.mockResolvedValue(false);
      const updatedWs = { id: 'ws-1', name: 'New Name', slug: 'new-name' };
      workspaceRepo.update.mockResolvedValue(updatedWs as any);

      const res = await service.update('ws-1', { name: 'New Name' });
      expect(res).toEqual(updatedWs);
    });

    it('should retry on P2002 during update and throw BusinessRuleException on 3 failures', async () => {
      const p2002Error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
      });
      workspaceRepo.findById.mockResolvedValue({ id: 'ws-1', name: 'Old Name' } as any);
      workspaceRepo.existsBySlug.mockResolvedValue(false);
      workspaceRepo.update.mockRejectedValue(p2002Error);

      await expect(service.update('ws-1', { name: 'New Name' })).rejects.toThrow(BusinessRuleException);
    });

    it('should rethrow non-P2002 errors during update with new name', async () => {
      workspaceRepo.findById.mockResolvedValue({ id: 'ws-1', name: 'Old Name' } as any);
      workspaceRepo.existsBySlug.mockResolvedValue(false);
      workspaceRepo.update.mockRejectedValue(new Error('Update failed'));

      await expect(service.update('ws-1', { name: 'New Name' })).rejects.toThrow('Update failed');
    });
  });

  describe('archive', () => {
    it('should archive workspace when found', async () => {
      workspaceRepo.findById.mockResolvedValue({ id: 'ws-1' } as any);
      workspaceRepo.archive.mockResolvedValue(undefined as any);

      await service.archive('ws-1');

      expect(workspaceRepo.archive).toHaveBeenCalledWith('ws-1');
    });
  });

  describe('getMembers', () => {
    it('should return workspace members', async () => {
      workspaceRepo.findById.mockResolvedValue({ id: 'ws-1' } as any);
      const mockMembers = [{ id: 'm-1', userId: 'u-1', role: WorkspaceRole.owner }];
      memberRepo.findMembersWithUser.mockResolvedValue(mockMembers as any);

      const result = await service.getMembers('ws-1');

      expect(result).toEqual(mockMembers);
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

    it('should throw BusinessRuleException if demoting sole owner', async () => {
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

  describe('inviteMember', () => {
    it('should throw ForbiddenException if admin attempts to invite owner or admin', async () => {
      workspaceRepo.findById.mockResolvedValue({ id: 'ws-1' } as any);
      memberRepo.findMember.mockResolvedValue({ role: WorkspaceRole.admin } as any);

      await expect(
        service.inviteMember('ws-1', { email: 'test@test.com', role: WorkspaceRole.owner }, 'admin-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BusinessRuleException if user is already a member', async () => {
      workspaceRepo.findById.mockResolvedValue({ id: 'ws-1' } as any);
      memberRepo.findMember.mockResolvedValueOnce({ role: WorkspaceRole.owner } as any);
      authService.findUserSummaryByEmail.mockResolvedValue({ id: 'u-existing' } as any);
      memberRepo.findMember.mockResolvedValueOnce({ id: 'm-existing' } as any);

      await expect(
        service.inviteMember('ws-1', { email: 'existing@test.com', role: WorkspaceRole.member }, 'owner-1'),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw BusinessRuleException if active pending invitation already exists', async () => {
      workspaceRepo.findById.mockResolvedValue({ id: 'ws-1' } as any);
      memberRepo.findMember.mockResolvedValue({ role: WorkspaceRole.owner } as any);
      authService.findUserSummaryByEmail.mockResolvedValue(null);
      invitationRepo.findPendingByEmailAndWorkspace.mockResolvedValue({ id: 'inv-active' } as any);

      await expect(
        service.inviteMember('ws-1', { email: 'pending@test.com', role: WorkspaceRole.member }, 'owner-1'),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should create invitation and return invitation with inviter profile', async () => {
      workspaceRepo.findById.mockResolvedValue({ id: 'ws-1' } as any);
      memberRepo.findMember.mockResolvedValue({ role: WorkspaceRole.owner } as any);
      authService.findUserSummaryByEmail.mockResolvedValue(null);
      invitationRepo.findPendingByEmailAndWorkspace.mockResolvedValue(null);
      const mockInvitation = {
        id: 'inv-1',
        workspaceId: 'ws-1',
        email: 'newuser@example.com',
        role: WorkspaceRole.member,
      };
      invitationRepo.createInvitation.mockResolvedValue(mockInvitation as any);
      authService.getProfile.mockResolvedValue({
        id: 'owner-1',
        displayName: 'Owner User',
        email: 'owner@example.com',
        avatarUrl: null,
      } as any);

      const result = await service.inviteMember(
        'ws-1',
        { email: 'newuser@example.com', role: WorkspaceRole.member },
        'owner-1',
      );

      expect(result).toEqual({
        ...mockInvitation,
        inviter: {
          id: 'owner-1',
          displayName: 'Owner User',
          email: 'owner@example.com',
          avatarUrl: null,
        },
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith('workspace.invitation_created', expect.any(Object));
    });
  });

  describe('getInvitations', () => {
    it('should return pending workspace invitations', async () => {
      workspaceRepo.findById.mockResolvedValue({ id: 'ws-1' } as any);
      invitationRepo.findWorkspaceInvitations.mockResolvedValue([{ id: 'inv-1' }] as any);

      const result = await service.getInvitations('ws-1');

      expect(result).toEqual([{ id: 'inv-1' }]);
    });
  });

  describe('acceptInvitation', () => {
    it('should throw BusinessRuleException when invitation expired or not pending', async () => {
      invitationRepo.findByToken.mockResolvedValue(null);

      await expect(service.acceptInvitation({ token: 'invalid' }, 'u-1')).rejects.toThrow(
        BusinessRuleException,
      );
    });

    it('should throw BusinessRuleException when target workspace is archived / not found', async () => {
      invitationRepo.findByToken.mockResolvedValue({
        id: 'inv-1',
        status: 'pending',
        expiresAt: new Date(Date.now() + 10000),
        workspaceId: 'ws-archived',
      } as any);
      workspaceRepo.findById.mockResolvedValue(null);

      await expect(service.acceptInvitation({ token: 'valid' }, 'u-1')).rejects.toThrow(
        BusinessRuleException,
      );
    });

    it('should throw BusinessRuleException if user email does not match invitation email', async () => {
      invitationRepo.findByToken.mockResolvedValue({
        id: 'inv-1',
        status: 'pending',
        expiresAt: new Date(Date.now() + 10000),
        workspaceId: 'ws-1',
        email: 'intended@example.com',
      } as any);
      workspaceRepo.findById.mockResolvedValue({ id: 'ws-1' } as any);
      authService.getProfile.mockResolvedValue({ email: 'different@example.com' } as any);

      await expect(service.acceptInvitation({ token: 'valid' }, 'u-1')).rejects.toThrow(
        BusinessRuleException,
      );
    });

    it('should throw BusinessRuleException if user is already a member of the workspace', async () => {
      invitationRepo.findByToken.mockResolvedValue({
        id: 'inv-1',
        status: 'pending',
        expiresAt: new Date(Date.now() + 10000),
        workspaceId: 'ws-1',
        email: 'user@example.com',
      } as any);
      workspaceRepo.findById.mockResolvedValue({ id: 'ws-1' } as any);
      authService.getProfile.mockResolvedValue({ email: 'user@example.com' } as any);
      memberRepo.findMember.mockResolvedValue({ id: 'm-1' } as any);

      await expect(service.acceptInvitation({ token: 'valid' }, 'u-1')).rejects.toThrow(
        BusinessRuleException,
      );
    });

    it('should accept invitation in transaction and add member', async () => {
      invitationRepo.findByToken.mockResolvedValue({
        id: 'inv-1',
        status: 'pending',
        expiresAt: new Date(Date.now() + 10000),
        workspaceId: 'ws-1',
        email: 'user@example.com',
        role: WorkspaceRole.member,
      } as any);
      workspaceRepo.findById.mockResolvedValue({ id: 'ws-1' } as any);
      authService.getProfile.mockResolvedValue({ email: 'user@example.com' } as any);
      memberRepo.findMember.mockResolvedValue(null);

      const mockMember = { id: 'm-new', workspaceId: 'ws-1', userId: 'u-1', role: WorkspaceRole.member };
      prismaMock.workspaceMember.create.mockResolvedValue(mockMember);

      const result = await service.acceptInvitation({ token: 'valid' }, 'u-1');

      expect(result).toEqual(mockMember);
      expect(eventEmitter.emit).toHaveBeenCalledWith('workspace.member_added', expect.any(Object));
    });
  });

  describe('revokeInvitation', () => {
    it('should throw EntityNotFoundException if invitation not found, wrong workspace, or not pending', async () => {
      invitationRepo.findById.mockResolvedValue(null);

      await expect(service.revokeInvitation('ws-1', 'inv-99')).rejects.toThrow(EntityNotFoundException);
    });

    it('should update status to revoked when valid', async () => {
      invitationRepo.findById.mockResolvedValue({
        id: 'inv-1',
        workspaceId: 'ws-1',
        status: 'pending',
      } as any);

      await service.revokeInvitation('ws-1', 'inv-1');

      expect(invitationRepo.updateStatus).toHaveBeenCalledWith('inv-1', InvitationStatus.revoked);
    });
  });

  describe('isUserMember', () => {
    it('should return true if member exists', async () => {
      memberRepo.findMember.mockResolvedValue({ id: 'm-1' } as any);
      expect(await service.isUserMember('ws-1', 'u-1')).toBe(true);
    });

    it('should return false if member does not exist', async () => {
      memberRepo.findMember.mockResolvedValue(null);
      expect(await service.isUserMember('ws-1', 'u-1')).toBe(false);
    });
  });

  describe('generateUniqueSlug edge cases', () => {
    it('should handle slug collisions in existsBySlug loop and generate random suffix', async () => {
      workspaceRepo.existsBySlug
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      workspaceRepo.createWorkspaceWithOwner.mockResolvedValue({ id: 'ws-1' } as any);

      await service.create({ name: 'Duplicate Name' }, 'u-1');

      expect(workspaceRepo.existsBySlug).toHaveBeenCalledTimes(2);
    });

    it('should fallback to "workspace" if name has no alphanumeric characters', async () => {
      workspaceRepo.existsBySlug.mockResolvedValue(false);
      workspaceRepo.createWorkspaceWithOwner.mockResolvedValue({ id: 'ws-1' } as any);

      await service.create({ name: '!@#$%' }, 'u-1');

      expect(workspaceRepo.createWorkspaceWithOwner).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'workspace' }),
        'u-1',
      );
    });
  });
});
