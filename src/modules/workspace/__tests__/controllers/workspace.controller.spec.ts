import { WorkspaceController } from '../../controllers/workspace.controller';
import { WorkspaceService } from '../../services/workspace.service';
import { WorkspaceRole } from '@prisma/client';

describe('WorkspaceController', () => {
  let controller: WorkspaceController;
  let service: jest.Mocked<WorkspaceService>;

  beforeEach(() => {
    service = {
      create: jest.fn(),
      findAllForUser: jest.fn(),
      findBySlug: jest.fn(),
      findById: jest.fn(),
      findByIdWithRole: jest.fn(),
      update: jest.fn(),
      archive: jest.fn(),
      leaveWorkspace: jest.fn(),
      transferOwnership: jest.fn(),
      getMembers: jest.fn(),
      updateMemberRole: jest.fn(),
      removeMember: jest.fn(),
      inviteMember: jest.fn(),
      getInvitations: jest.fn(),
      acceptInvitation: jest.fn(),
      revokeInvitation: jest.fn(),
    } as unknown as jest.Mocked<WorkspaceService>;

    controller = new WorkspaceController(service);
  });

  const mockUser = {
    sub: 'user-123',
    email: 'user@example.com',
    displayName: 'User Test',
  } as any;

  describe('create', () => {
    it('should delegate creation to workspaceService', async () => {
      const mockWs = { id: 'ws-1', name: 'Eng' };
      service.create.mockResolvedValue(mockWs as any);

      const res = await controller.create({ name: 'Eng' }, mockUser);
      expect(res).toEqual(mockWs);
      expect(service.create).toHaveBeenCalledWith({ name: 'Eng' }, 'user-123');
    });
  });

  describe('listMine', () => {
    it('should return user workspaces from service', async () => {
      const mockList = [{ id: 'ws-1', role: WorkspaceRole.owner }];
      service.findAllForUser.mockResolvedValue(mockList as any);

      const res = await controller.listMine(mockUser);
      expect(res).toEqual(mockList);
      expect(service.findAllForUser).toHaveBeenCalledWith('user-123');
    });
  });

  describe('getBySlug', () => {
    it('should delegate to workspaceService.findBySlug', async () => {
      const mockWs = { id: 'ws-1', slug: 'eng', role: WorkspaceRole.owner };
      service.findBySlug.mockResolvedValue(mockWs as any);

      const res = await controller.getBySlug('eng', mockUser);
      expect(res).toEqual(mockWs);
      expect(service.findBySlug).toHaveBeenCalledWith('eng', 'user-123');
    });
  });

  describe('getById', () => {
    it('should delegate to workspaceService.findByIdWithRole', async () => {
      const mockWs = { id: 'ws-1', name: 'Eng', role: WorkspaceRole.owner };
      service.findByIdWithRole.mockResolvedValue(mockWs as any);

      const res = await controller.getById('ws-1', mockUser);
      expect(res).toEqual(mockWs);
      expect(service.findByIdWithRole).toHaveBeenCalledWith('ws-1', 'user-123');
    });
  });

  describe('update', () => {
    it('should delegate update to workspaceService', async () => {
      const updatedWs = { id: 'ws-1', name: 'Updated' };
      service.update.mockResolvedValue(updatedWs as any);

      const res = await controller.update('ws-1', { name: 'Updated' });
      expect(res).toEqual(updatedWs);
      expect(service.update).toHaveBeenCalledWith('ws-1', { name: 'Updated' });
    });
  });

  describe('archive', () => {
    it('should delegate archive to workspaceService', async () => {
      service.archive.mockResolvedValue(undefined);

      await controller.archive('ws-1');
      expect(service.archive).toHaveBeenCalledWith('ws-1');
    });
  });

  describe('getMembers', () => {
    it('should delegate getMembers to workspaceService', async () => {
      const members = [{ id: 'm-1', role: WorkspaceRole.owner }];
      service.getMembers.mockResolvedValue(members as any);

      const res = await controller.getMembers('ws-1');
      expect(res).toEqual(members);
      expect(service.getMembers).toHaveBeenCalledWith('ws-1');
    });
  });

  describe('updateMemberRole', () => {
    it('should delegate updateMemberRole to workspaceService', async () => {
      const updatedMember = { id: 'm-1', role: WorkspaceRole.admin };
      service.updateMemberRole.mockResolvedValue(updatedMember as any);

      const res = await controller.updateMemberRole(
        'ws-1',
        'm-1',
        { role: WorkspaceRole.admin },
        mockUser,
      );
      expect(res).toEqual(updatedMember);
      expect(service.updateMemberRole).toHaveBeenCalledWith(
        'ws-1',
        'm-1',
        { role: WorkspaceRole.admin },
        'user-123',
      );
    });
  });

  describe('removeMember', () => {
    it('should delegate removeMember to workspaceService', async () => {
      service.removeMember.mockResolvedValue(undefined);

      await controller.removeMember('ws-1', 'm-1', mockUser);
      expect(service.removeMember).toHaveBeenCalledWith('ws-1', 'm-1', 'user-123');
    });
  });

  describe('leaveWorkspace', () => {
    it('should delegate leaveWorkspace to service', async () => {
      service.leaveWorkspace.mockResolvedValue(undefined);

      await controller.leaveWorkspace('ws-1', mockUser);
      expect(service.leaveWorkspace).toHaveBeenCalledWith('ws-1', 'user-123');
    });
  });

  describe('transferOwnership', () => {
    it('should delegate transferOwnership to service', async () => {
      const mockMember = { id: 'm-2', role: WorkspaceRole.owner };
      service.transferOwnership.mockResolvedValue(mockMember as any);

      const res = await controller.transferOwnership(
        'ws-1',
        { newOwnerId: 'user-456' },
        mockUser,
      );

      expect(res).toEqual(mockMember);
      expect(service.transferOwnership).toHaveBeenCalledWith(
        'ws-1',
        'user-123',
        'user-456',
      );
    });
  });

  describe('inviteMember', () => {
    it('should delegate inviteMember to workspaceService', async () => {
      const invite = { id: 'inv-1', email: 'test@example.com' };
      service.inviteMember.mockResolvedValue(invite as any);

      const res = await controller.inviteMember(
        'ws-1',
        { email: 'test@example.com', role: WorkspaceRole.member },
        mockUser,
      );

      expect(res).toEqual(invite);
      expect(service.inviteMember).toHaveBeenCalledWith(
        'ws-1',
        { email: 'test@example.com', role: WorkspaceRole.member },
        'user-123',
      );
    });
  });

  describe('getInvitations', () => {
    it('should delegate getInvitations to workspaceService', async () => {
      const invites = [{ id: 'inv-1' }];
      service.getInvitations.mockResolvedValue(invites as any);

      const res = await controller.getInvitations('ws-1');
      expect(res).toEqual(invites);
      expect(service.getInvitations).toHaveBeenCalledWith('ws-1');
    });
  });

  describe('acceptInvitation', () => {
    it('should call acceptInvitation on service', async () => {
      const mockMember = { id: 'm-1' };
      service.acceptInvitation.mockResolvedValue(mockMember as any);

      const res = await controller.acceptInvitation(
        { token: 'token-abc' },
        mockUser,
      );

      expect(res).toEqual(mockMember);
      expect(service.acceptInvitation).toHaveBeenCalledWith(
        { token: 'token-abc' },
        'user-123',
      );
    });
  });

  describe('revokeInvitation', () => {
    it('should delegate revokeInvitation to workspaceService', async () => {
      service.revokeInvitation.mockResolvedValue(undefined);

      await controller.revokeInvitation('ws-1', 'inv-1');
      expect(service.revokeInvitation).toHaveBeenCalledWith('ws-1', 'inv-1');
    });
  });
});
