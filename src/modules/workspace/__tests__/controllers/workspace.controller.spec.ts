import { WorkspaceController } from '../../controllers/workspace.controller';
import { WorkspaceService } from '../../services/workspace.service';
import { MembershipService } from '../../services/membership.service';
import { InvitationService } from '../../services/invitation.service';
import { WorkspaceRole } from '@prisma/client';

describe('WorkspaceController', () => {
  let controller: WorkspaceController;
  let workspaceService: jest.Mocked<WorkspaceService>;
  let membershipService: jest.Mocked<MembershipService>;
  let invitationService: jest.Mocked<InvitationService>;

  beforeEach(() => {
    workspaceService = {
      create: jest.fn(),
      findAllForUser: jest.fn(),
      findBySlug: jest.fn(),
      findByIdWithRole: jest.fn(),
      update: jest.fn(),
      archive: jest.fn(),
    } as unknown as jest.Mocked<WorkspaceService>;

    membershipService = {
      getMembers: jest.fn(),
      updateMemberRole: jest.fn(),
      removeMember: jest.fn(),
      leaveWorkspace: jest.fn(),
      transferOwnership: jest.fn(),
    } as unknown as jest.Mocked<MembershipService>;

    invitationService = {
      inviteMember: jest.fn(),
      getInvitations: jest.fn(),
      acceptInvitation: jest.fn(),
      revokeInvitation: jest.fn(),
    } as unknown as jest.Mocked<InvitationService>;

    controller = new WorkspaceController(
      workspaceService,
      membershipService,
      invitationService,
    );
  });

  const mockUser = {
    sub: 'user-123',
    email: 'user@example.com',
    displayName: 'User Test',
  } as any;

  describe('create', () => {
    it('should delegate creation to workspaceService', async () => {
      const mockWs = { id: 'ws-1', name: 'Eng' };
      workspaceService.create.mockResolvedValue(mockWs as any);

      const res = await controller.create({ name: 'Eng' }, mockUser);
      expect(res).toEqual(mockWs);
      expect(workspaceService.create).toHaveBeenCalledWith(
        { name: 'Eng' },
        'user-123',
      );
    });
  });

  describe('listMine', () => {
    it('should return paginated user workspaces from service', async () => {
      const mockList = {
        items: [{ id: 'ws-1', role: WorkspaceRole.owner }],
        pagination: { cursor: 'ws-1', hasMore: false },
      };
      workspaceService.findAllForUser.mockResolvedValue(mockList as any);

      const res = await controller.listMine(mockUser, {
        cursor: 'ws-1',
        limit: 20,
      });
      expect(res).toEqual(mockList);
      expect(workspaceService.findAllForUser).toHaveBeenCalledWith('user-123', {
        cursor: 'ws-1',
        limit: 20,
      });
    });
  });

  describe('getBySlug', () => {
    it('should delegate to workspaceService.findBySlug', async () => {
      const mockWs = { id: 'ws-1', slug: 'eng', role: WorkspaceRole.owner };
      workspaceService.findBySlug.mockResolvedValue(mockWs as any);

      const res = await controller.getBySlug('eng', mockUser);
      expect(res).toEqual(mockWs);
      expect(workspaceService.findBySlug).toHaveBeenCalledWith(
        'eng',
        'user-123',
      );
    });
  });

  describe('getById', () => {
    it('should delegate to workspaceService.findByIdWithRole', async () => {
      const mockWs = { id: 'ws-1', name: 'Eng', role: WorkspaceRole.owner };
      workspaceService.findByIdWithRole.mockResolvedValue(mockWs as any);

      const res = await controller.getById('ws-1', mockUser);
      expect(res).toEqual(mockWs);
      expect(workspaceService.findByIdWithRole).toHaveBeenCalledWith(
        'ws-1',
        'user-123',
      );
    });
  });

  describe('update', () => {
    it('should delegate update to workspaceService', async () => {
      const updatedWs = { id: 'ws-1', name: 'Updated' };
      workspaceService.update.mockResolvedValue(updatedWs as any);

      const res = await controller.update('ws-1', { name: 'Updated' });
      expect(res).toEqual(updatedWs);
      expect(workspaceService.update).toHaveBeenCalledWith('ws-1', {
        name: 'Updated',
      });
    });
  });

  describe('archive', () => {
    it('should delegate archive to workspaceService', async () => {
      workspaceService.archive.mockResolvedValue(undefined);

      await controller.archive('ws-1');
      expect(workspaceService.archive).toHaveBeenCalledWith('ws-1');
    });
  });

  describe('leaveWorkspace', () => {
    it('should delegate leaveWorkspace to membershipService', async () => {
      membershipService.leaveWorkspace.mockResolvedValue(undefined);

      await controller.leaveWorkspace('ws-1', mockUser);
      expect(membershipService.leaveWorkspace).toHaveBeenCalledWith(
        'ws-1',
        'user-123',
      );
    });
  });

  describe('transferOwnership', () => {
    it('should delegate transferOwnership to membershipService', async () => {
      const mockMember = { id: 'm-2', role: WorkspaceRole.owner };
      membershipService.transferOwnership.mockResolvedValue(mockMember as any);

      const res = await controller.transferOwnership(
        'ws-1',
        { newOwnerId: 'user-456' },
        mockUser,
      );

      expect(res).toEqual(mockMember);
      expect(membershipService.transferOwnership).toHaveBeenCalledWith(
        'ws-1',
        'user-123',
        'user-456',
      );
    });
  });

  describe('getMembers', () => {
    it('should delegate getMembers to membershipService', async () => {
      const members = [{ id: 'm-1', role: WorkspaceRole.owner }];
      membershipService.getMembers.mockResolvedValue(members as any);

      const res = await controller.getMembers('ws-1');
      expect(res).toEqual(members);
      expect(membershipService.getMembers).toHaveBeenCalledWith('ws-1');
    });
  });

  describe('updateMemberRole', () => {
    it('should delegate updateMemberRole to membershipService', async () => {
      const updatedMember = { id: 'm-1', role: WorkspaceRole.admin };
      membershipService.updateMemberRole.mockResolvedValue(
        updatedMember as any,
      );

      const res = await controller.updateMemberRole(
        'ws-1',
        'm-1',
        { role: WorkspaceRole.admin },
        mockUser,
      );
      expect(res).toEqual(updatedMember);
      expect(membershipService.updateMemberRole).toHaveBeenCalledWith(
        'ws-1',
        'm-1',
        { role: WorkspaceRole.admin },
        'user-123',
      );
    });
  });

  describe('removeMember', () => {
    it('should delegate removeMember to membershipService', async () => {
      membershipService.removeMember.mockResolvedValue(undefined);

      await controller.removeMember('ws-1', 'm-1', mockUser);
      expect(membershipService.removeMember).toHaveBeenCalledWith(
        'ws-1',
        'm-1',
        'user-123',
      );
    });
  });

  describe('acceptInvitation', () => {
    it('should call acceptInvitation on invitationService', async () => {
      const mockMember = { id: 'm-1' };
      invitationService.acceptInvitation.mockResolvedValue(mockMember as any);

      const res = await controller.acceptInvitation(
        { token: 'token-abc' },
        mockUser,
      );

      expect(res).toEqual(mockMember);
      expect(invitationService.acceptInvitation).toHaveBeenCalledWith(
        { token: 'token-abc' },
        'user-123',
      );
    });
  });

  describe('inviteMember', () => {
    it('should delegate inviteMember to invitationService', async () => {
      const invite = { id: 'inv-1', email: 'test@example.com' };
      invitationService.inviteMember.mockResolvedValue(invite as any);

      const res = await controller.inviteMember(
        'ws-1',
        { email: 'test@example.com', role: WorkspaceRole.member },
        mockUser,
      );

      expect(res).toEqual(invite);
      expect(invitationService.inviteMember).toHaveBeenCalledWith(
        'ws-1',
        { email: 'test@example.com', role: WorkspaceRole.member },
        'user-123',
      );
    });
  });

  describe('getInvitations', () => {
    it('should delegate getInvitations to invitationService', async () => {
      const invites = [{ id: 'inv-1' }];
      invitationService.getInvitations.mockResolvedValue(invites as any);

      const res = await controller.getInvitations('ws-1');
      expect(res).toEqual(invites);
      expect(invitationService.getInvitations).toHaveBeenCalledWith('ws-1');
    });
  });

  describe('revokeInvitation', () => {
    it('should delegate revokeInvitation to invitationService', async () => {
      invitationService.revokeInvitation.mockResolvedValue(undefined);

      await controller.revokeInvitation('ws-1', 'inv-1');
      expect(invitationService.revokeInvitation).toHaveBeenCalledWith(
        'ws-1',
        'inv-1',
      );
    });
  });
});
