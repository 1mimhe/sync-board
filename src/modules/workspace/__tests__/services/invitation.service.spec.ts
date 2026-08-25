import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { ForbiddenException } from '@nestjs/common';
import { WorkspaceRole, InvitationStatus } from '@prisma/client';
import { InvitationService } from '../../services/invitation.service';
import { MembershipService } from '../../services/membership.service';
import { AuthService } from '../../../auth/services/auth.service';
import { WorkspaceRepository } from '../../repositories/workspace.repository';
import { WorkspaceMemberRepository } from '../../repositories/workspace-member.repository';
import { WorkspaceInvitationRepository } from '../../repositories/workspace-invitation.repository';
import { PrismaService } from '../../../../common/database/prisma.service';
import {
  EntityNotFoundException,
  BusinessRuleException,
} from '../../../../common/exceptions/app.exception';

describe('InvitationService', () => {
  let service: InvitationService;
  let workspaceRepo: DeepMockProxy<WorkspaceRepository>;
  let memberRepo: DeepMockProxy<WorkspaceMemberRepository>;
  let invitationRepo: DeepMockProxy<WorkspaceInvitationRepository>;
  let membershipService: DeepMockProxy<MembershipService>;
  let authService: DeepMockProxy<AuthService>;
  let prismaMock: {
    $transaction: jest.Mock;
    workspaceMember: { create: jest.Mock };
    workspaceInvitation: { update: jest.Mock };
  };
  let eventEmitter: DeepMockProxy<EventEmitter2>;

  beforeEach(async () => {
    workspaceRepo = mockDeep<WorkspaceRepository>();
    memberRepo = mockDeep<WorkspaceMemberRepository>();
    invitationRepo = mockDeep<WorkspaceInvitationRepository>();
    membershipService = mockDeep<MembershipService>();
    authService = mockDeep<AuthService>();
    eventEmitter = mockDeep<EventEmitter2>();

    prismaMock = {
      $transaction: jest.fn().mockImplementation((cb) => cb(prismaMock)),
      workspaceMember: {
        create: jest.fn(),
      },
      workspaceInvitation: {
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: WorkspaceRepository, useValue: workspaceRepo },
        { provide: WorkspaceMemberRepository, useValue: memberRepo },
        { provide: WorkspaceInvitationRepository, useValue: invitationRepo },
        { provide: MembershipService, useValue: membershipService },
        { provide: AuthService, useValue: authService },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<InvitationService>(InvitationService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('inviteMember', () => {
    it('should throw ForbiddenException if admin attempts to invite owner or admin', async () => {
      membershipService.requireWorkspace.mockResolvedValue(undefined);
      memberRepo.findMember.mockResolvedValue({ role: WorkspaceRole.admin } as any);

      await expect(
        service.inviteMember('ws-1', { email: 'test@test.com', role: WorkspaceRole.owner }, 'admin-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BusinessRuleException ALREADY_A_MEMBER if user is already a member', async () => {
      membershipService.requireWorkspace.mockResolvedValue(undefined);
      memberRepo.findMember
        .mockResolvedValueOnce({ role: WorkspaceRole.owner } as any)
        .mockResolvedValueOnce({ id: 'm-existing' } as any);
      authService.findUserSummaryByEmail.mockResolvedValue({ id: 'u-existing' } as any);

      await expect(
        service.inviteMember('ws-1', { email: 'existing@test.com', role: WorkspaceRole.member }, 'owner-1'),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should allow admin to invite member or viewer roles', async () => {
      membershipService.requireWorkspace.mockResolvedValue(undefined);
      memberRepo.findMember.mockResolvedValue({ role: WorkspaceRole.admin } as any);
      authService.findUserSummaryByEmail.mockResolvedValue(null);
      invitationRepo.findPendingByEmailAndWorkspace.mockResolvedValue(null);
      invitationRepo.createInvitation.mockResolvedValue({
        id: 'inv-2',
        email: 'viewer@test.com',
        role: WorkspaceRole.viewer,
      } as any);
      authService.getProfile.mockResolvedValue({
        id: 'admin-1',
        displayName: 'Admin',
        email: 'admin@example.com',
        avatarUrl: null,
      } as any);

      const result = await service.inviteMember(
        'ws-1',
        { email: 'viewer@test.com', role: WorkspaceRole.viewer },
        'admin-1',
      );

      expect(result.role).toBe(WorkspaceRole.viewer);
    });

    it('should proceed when email belongs to a registered user who is not yet a member', async () => {
      membershipService.requireWorkspace.mockResolvedValue(undefined);
      memberRepo.findMember
        .mockResolvedValueOnce({ role: WorkspaceRole.owner } as any)
        .mockResolvedValueOnce(null);
      authService.findUserSummaryByEmail.mockResolvedValue({ id: 'u-new' } as any);
      invitationRepo.findPendingByEmailAndWorkspace.mockResolvedValue(null);
      invitationRepo.createInvitation.mockResolvedValue({
        id: 'inv-3',
        email: 'registered@test.com',
        role: WorkspaceRole.member,
      } as any);
      authService.getProfile.mockResolvedValue({
        id: 'owner-1',
        displayName: 'Owner',
        email: 'owner@example.com',
        avatarUrl: null,
      } as any);

      const result = await service.inviteMember(
        'ws-1',
        { email: 'registered@test.com', role: WorkspaceRole.member },
        'owner-1',
      );

      expect(invitationRepo.createInvitation).toHaveBeenCalled();
      expect(result.email).toBe('registered@test.com');
    });

    it('should throw BusinessRuleException INVITATION_ALREADY_SENT if active pending invitation already exists', async () => {
      membershipService.requireWorkspace.mockResolvedValue(undefined);
      memberRepo.findMember.mockResolvedValue({ role: WorkspaceRole.owner } as any);
      authService.findUserSummaryByEmail.mockResolvedValue(null);
      invitationRepo.findPendingByEmailAndWorkspace.mockResolvedValue({ id: 'inv-active' } as any);

      await expect(
        service.inviteMember('ws-1', { email: 'pending@test.com', role: WorkspaceRole.member }, 'owner-1'),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should store hashed token (not raw) and emit invitation_created with raw token', async () => {
      membershipService.requireWorkspace.mockResolvedValue(undefined);
      memberRepo.findMember.mockResolvedValue({ role: WorkspaceRole.owner } as any);
      authService.findUserSummaryByEmail.mockResolvedValue(null);
      invitationRepo.findPendingByEmailAndWorkspace.mockResolvedValue(null);
      const mockInvitation = {
        id: 'inv-1',
        workspaceId: 'ws-1',
        email: 'newuser@example.com',
        role: WorkspaceRole.member,
        token: 'hashed-token-value',
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

      const createdArg = invitationRepo.createInvitation.mock.calls[0][0];
      expect(createdArg.token).not.toBe(createdArg.email); // sanity
      expect(createdArg.token).toEqual(expect.stringMatching(/^[a-f0-9]{64}$/));
      expect(result).toEqual({
        ...mockInvitation,
        inviter: {
          id: 'owner-1',
          displayName: 'Owner User',
          email: 'owner@example.com',
          avatarUrl: null,
        },
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'workspace.invitation_created',
        expect.anything(),
      );
    });
  });

  describe('getInvitations', () => {
    it('should return pending workspace invitations', async () => {
      membershipService.requireWorkspace.mockResolvedValue(undefined);
      invitationRepo.findWorkspaceInvitations.mockResolvedValue([{ id: 'inv-1' }] as any);

      const result = await service.getInvitations('ws-1');

      expect(result).toEqual([{ id: 'inv-1' }]);
      expect(membershipService.requireWorkspace).toHaveBeenCalledWith('ws-1');
    });

    it('should propagate EntityNotFoundException when workspace missing', async () => {
      membershipService.requireWorkspace.mockRejectedValue(
        new EntityNotFoundException('Workspace', 'ws-x'),
      );

      await expect(service.getInvitations('ws-x')).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe('acceptInvitation', () => {
    it('should throw BusinessRuleException INVITATION_EXPIRED when token unknown or not pending', async () => {
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

    it('should throw BusinessRuleException ALREADY_A_MEMBER if user is already a member of the workspace', async () => {
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

    it('should accept invitation in transaction and emit member_added', async () => {
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

      expect(prismaMock.workspaceInvitation.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: expect.objectContaining({ status: InvitationStatus.accepted }),
      });
      expect(result).toEqual(mockMember);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'workspace.member_added',
        expect.anything(),
      );
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
});
