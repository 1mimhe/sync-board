import { WorkspaceService } from '../services/workspace.service';
import { WorkspaceRepository } from '../repositories/workspace.repository';
import { WorkspaceMemberRepository } from '../repositories/workspace-member.repository';
import { WorkspaceInvitationRepository } from '../repositories/workspace-invitation.repository';
import { AuthService } from '../../auth/services/auth.service';
import { PrismaService } from '../../../common/database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WorkspaceRole, InvitationStatus } from '@prisma/client';
import {
  EntityNotFoundException,
  BusinessRuleException,
} from '../../../common/exceptions/app.exception';

describe('WorkspaceService', () => {
  let service: WorkspaceService;
  let prismaMock: any;
  let workspaceRepo: jest.Mocked<WorkspaceRepository>;
  let memberRepo: jest.Mocked<WorkspaceMemberRepository>;
  let invitationRepo: jest.Mocked<WorkspaceInvitationRepository>;
  let authService: jest.Mocked<AuthService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(() => {
    prismaMock = {
      $transaction: jest.fn((cb) => cb(prismaMock)),
      workspaceMember: {
        create: jest.fn(),
      },
      workspaceInvitation: {
        update: jest.fn(),
      },
      workspace: {
        update: jest.fn(),
      },
    };

    workspaceRepo = {
      createWorkspaceWithOwner: jest.fn(),
      findById: jest.fn(),
      findBySlug: jest.fn(),
      findUserWorkspaces: jest.fn(),
      update: jest.fn(),
      archive: jest.fn(),
    } as unknown as jest.Mocked<WorkspaceRepository>;

    memberRepo = {
      findMember: jest.fn(),
      findMemberById: jest.fn(),
      findMembersWithUser: jest.fn(),
      findOtherOwner: jest.fn(),
      countOwners: jest.fn(),
      createMember: jest.fn(),
      updateRole: jest.fn(),
      removeMember: jest.fn(),
    } as unknown as jest.Mocked<WorkspaceMemberRepository>;

    invitationRepo = {
      createInvitation: jest.fn(),
      findByToken: jest.fn(),
      findById: jest.fn(),
      findPendingByEmailAndWorkspace: jest.fn(),
      findWorkspaceInvitations: jest.fn(),
      updateStatus: jest.fn(),
    } as unknown as jest.Mocked<WorkspaceInvitationRepository>;

    authService = {
      getUserByEmail: jest.fn(),
      findUserSummaryByEmail: jest.fn(),
      getProfile: jest.fn(),
    } as unknown as jest.Mocked<AuthService>;

    eventEmitter = {
      emit: jest.fn(),
    } as unknown as jest.Mocked<EventEmitter2>;

    service = new WorkspaceService(
      prismaMock as PrismaService,
      workspaceRepo,
      memberRepo,
      invitationRepo,
      authService,
      eventEmitter,
    );
  });

  describe('create', () => {
    it('should generate slug and create workspace with owner', async () => {
      const mockWs = {
        id: 'ws-1',
        name: 'My Team',
        slug: 'my-team',
        ownerId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        archivedAt: null,
      };

      workspaceRepo.findBySlug.mockResolvedValue(null);
      workspaceRepo.createWorkspaceWithOwner.mockResolvedValue(mockWs as any);

      const res = await service.create({ name: 'My Team' }, 'user-1');

      expect(res).toEqual(mockWs);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'workspace.created',
        expect.objectContaining({ workspace: mockWs, ownerId: 'user-1' }),
      );
    });
  });

  describe('findById', () => {
    it('should return workspace if found', async () => {
      const mockWs = { id: 'ws-1', name: 'WS' };
      workspaceRepo.findById.mockResolvedValue(mockWs as any);

      const res = await (service as any).findById('ws-1');
      expect(res).toEqual(mockWs);
    });

    it('should throw EntityNotFoundException if not found', async () => {
      workspaceRepo.findById.mockResolvedValue(null);

      await expect((service as any).findById('ws-99')).rejects.toThrow(
        EntityNotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update workspace and regenerate slug when name changes', async () => {
      const existingWs = { id: 'ws-1', name: 'Old Team', slug: 'old-team' };
      const updatedWs = { id: 'ws-1', name: 'New Team', slug: 'new-team' };
      workspaceRepo.findById.mockResolvedValue(existingWs as any);
      workspaceRepo.findBySlug.mockResolvedValue(null);
      workspaceRepo.update.mockResolvedValue(updatedWs as any);

      const res = await service.update('ws-1', { name: 'New Team' });

      expect(workspaceRepo.update).toHaveBeenCalledWith('ws-1', {
        name: 'New Team',
        slug: 'new-team',
      });
      expect(res).toEqual(updatedWs);
    });

    it('should update workspace without regenerating slug when name does not change', async () => {
      const existingWs = { id: 'ws-1', name: 'Old Team', slug: 'old-team' };
      const updatedWs = { ...existingWs, description: 'Updated desc' };
      workspaceRepo.findById.mockResolvedValue(existingWs as any);
      workspaceRepo.update.mockResolvedValue(updatedWs as any);

      const res = await service.update('ws-1', { description: 'Updated desc' });

      expect(workspaceRepo.update).toHaveBeenCalledWith('ws-1', {
        description: 'Updated desc',
      });
      expect(res).toEqual(updatedWs);
    });
  });

  describe('updateMemberRole', () => {
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

    it('should update role if multiple owners exist', async () => {
      const mockMember = {
        id: 'm-1',
        workspaceId: 'ws-1',
        userId: 'user-1',
        role: WorkspaceRole.owner,
      };

      memberRepo.findMemberById.mockResolvedValue(mockMember as any);
      memberRepo.countOwners.mockResolvedValue(2);
      workspaceRepo.findById.mockResolvedValue({
        id: 'ws-1',
        ownerId: 'user-2',
      } as any);
      memberRepo.updateRole.mockResolvedValue({
        ...mockMember,
        role: WorkspaceRole.admin,
      } as any);

      const res = await service.updateMemberRole('ws-1', 'm-1', {
        role: WorkspaceRole.admin,
      });

      expect(res.role).toBe(WorkspaceRole.admin);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'workspace.member_role_changed',
        expect.anything(),
      );
    });
  });

  describe('inviteMember', () => {
    it('should throw BusinessRuleException if user is already a member', async () => {
      workspaceRepo.findById.mockResolvedValue({ id: 'ws-1' } as any);
      authService.findUserSummaryByEmail.mockResolvedValue({
        id: 'u-2',
      } as any);
      memberRepo.findMember.mockResolvedValue({ id: 'm-2' } as any);

      await expect(
        service.inviteMember(
          'ws-1',
          { email: 'member@test.com', role: WorkspaceRole.member },
          'u-1',
        ),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should send invitation if valid', async () => {
      workspaceRepo.findById.mockResolvedValue({ id: 'ws-1' } as any);
      authService.findUserSummaryByEmail.mockResolvedValue(null);
      invitationRepo.findPendingByEmailAndWorkspace.mockResolvedValue(null);

      const mockInvite = {
        id: 'inv-1',
        workspaceId: 'ws-1',
        email: 'new@test.com',
        role: WorkspaceRole.member,
        token: 'token123',
        invitedBy: 'u-1',
        status: InvitationStatus.pending,
        expiresAt: new Date(Date.now() + 10000),
      };

      invitationRepo.createInvitation.mockResolvedValue(mockInvite as any);
      authService.getProfile.mockResolvedValue({
        id: 'u-1',
        displayName: 'Inviter User',
        email: 'inviter@test.com',
        avatarUrl: null,
      } as any);

      const res = await service.inviteMember(
        'ws-1',
        { email: 'new@test.com', role: WorkspaceRole.member },
        'u-1',
      );

      expect(res.id).toBe('inv-1');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'workspace.invitation_created',
        expect.anything(),
      );
    });
  });

  describe('acceptInvitation', () => {
    it('should accept invitation and add user as member', async () => {
      const mockInvite = {
        id: 'inv-1',
        workspaceId: 'ws-1',
        email: 'user@test.com',
        role: WorkspaceRole.member,
        token: 'valid-token',
        status: InvitationStatus.pending,
        expiresAt: new Date(Date.now() + 100000),
      };

      invitationRepo.findByToken.mockResolvedValue(mockInvite as any);
      workspaceRepo.findById.mockResolvedValue({ id: 'ws-1' } as any);
      authService.getProfile.mockResolvedValue({
        id: 'u-2',
        email: 'user@test.com',
      } as any);
      memberRepo.findMember.mockResolvedValue(null);

      const mockCreatedMember = {
        id: 'm-new',
        workspaceId: 'ws-1',
        userId: 'u-2',
        role: WorkspaceRole.member,
      };

      prismaMock.workspaceMember.create.mockResolvedValue(mockCreatedMember);

      const res = await service.acceptInvitation(
        { token: 'valid-token' },
        'u-2',
      );

      expect(res.id).toBe('m-new');
    });

    it('should throw BusinessRuleException if user is already a member', async () => {
      const mockInvite = {
        id: 'inv-1',
        workspaceId: 'ws-1',
        email: 'user@test.com',
        role: WorkspaceRole.member,
        token: 'valid-token',
        status: InvitationStatus.pending,
        expiresAt: new Date(Date.now() + 100000),
      };

      invitationRepo.findByToken.mockResolvedValue(mockInvite as any);
      workspaceRepo.findById.mockResolvedValue({ id: 'ws-1' } as any);
      authService.getProfile.mockResolvedValue({
        id: 'u-2',
        email: 'user@test.com',
      } as any);
      memberRepo.findMember.mockResolvedValue({ id: 'existing-m' } as any);

      await expect(
        service.acceptInvitation({ token: 'valid-token' }, 'u-2'),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw BusinessRuleException if invitation email does not match accepting user email', async () => {
      const mockInvite = {
        id: 'inv-1',
        workspaceId: 'ws-1',
        email: 'target@test.com',
        role: WorkspaceRole.member,
        token: 'valid-token',
        status: InvitationStatus.pending,
        expiresAt: new Date(Date.now() + 100000),
      };

      invitationRepo.findByToken.mockResolvedValue(mockInvite as any);
      workspaceRepo.findById.mockResolvedValue({ id: 'ws-1' } as any);
      authService.getProfile.mockResolvedValue({
        id: 'u-other',
        email: 'other@test.com',
      } as any);

      await expect(
        service.acceptInvitation({ token: 'valid-token' }, 'u-other'),
      ).rejects.toThrow(BusinessRuleException);
    });
  });
});
