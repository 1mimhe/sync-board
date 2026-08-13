import { WorkspaceRepository } from '../repositories/workspace.repository';
import { PrismaService } from '../../../common/database/prisma.service';
import { WorkspaceRole } from '@prisma/client';

describe('WorkspaceRepository', () => {
  let repository: WorkspaceRepository;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(),
      workspace: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaService>;

    repository = new WorkspaceRepository(prisma);
  });

  describe('createWorkspaceWithOwner', () => {
    it('should execute transaction creating workspace and workspace owner member', async () => {
      const mockWorkspace = {
        id: 'ws-1',
        name: 'Test WS',
        slug: 'test-ws',
        ownerId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        archivedAt: null,
      };

      const mockTx = {
        workspace: {
          create: jest.fn().mockResolvedValue(mockWorkspace),
        },
        workspaceMember: {
          create: jest.fn().mockResolvedValue({}),
        },
      };

      (prisma.$transaction as jest.Mock).mockImplementation((cb) => cb(mockTx));

      const result = await repository.createWorkspaceWithOwner(
        { name: 'Test WS', slug: 'test-ws' },
        'user-1',
      );

      expect(result).toEqual(mockWorkspace);
      expect(mockTx.workspace.create).toHaveBeenCalledWith({
        data: {
          name: 'Test WS',
          slug: 'test-ws',
          description: undefined,
          ownerId: 'user-1',
        },
      });
      expect(mockTx.workspaceMember.create).toHaveBeenCalledWith({
        data: {
          workspaceId: 'ws-1',
          userId: 'user-1',
          role: WorkspaceRole.owner,
        },
      });
    });
  });

  describe('findById', () => {
    it('should return workspace if active', async () => {
      const mockWorkspace = { id: 'ws-1', name: 'WS 1', slug: 'ws-1' };
      (prisma.workspace.findFirst as jest.Mock).mockResolvedValue(
        mockWorkspace,
      );

      const res = await repository.findById('ws-1');
      expect(res).toEqual(mockWorkspace);
      expect(prisma.workspace.findFirst).toHaveBeenCalledWith({
        where: { id: 'ws-1', archivedAt: null },
      });
    });
  });
});
