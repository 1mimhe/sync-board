import { WorkspaceController } from '../controllers/workspace.controller';
import { WorkspaceService } from '../services/workspace.service';
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
      update: jest.fn(),
      archive: jest.fn(),
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
});
