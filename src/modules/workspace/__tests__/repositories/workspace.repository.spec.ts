import { WorkspaceRepository } from '../../repositories/workspace.repository';
import { PrismaService } from '../../../../common/database/prisma.service';
import { Prisma, WorkspaceRole } from '@prisma/client';

describe('WorkspaceRepository', () => {
  let repository: WorkspaceRepository;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(),
      workspace: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
    };

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

      prisma.$transaction.mockImplementation((cb: Function) => cb(mockTx));

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
      prisma.workspace.findFirst.mockResolvedValue(mockWorkspace);

      const res = await repository.findById('ws-1');
      expect(res).toEqual(mockWorkspace);
      expect(prisma.workspace.findFirst).toHaveBeenCalledWith({
        where: { id: 'ws-1', archivedAt: null },
      });
    });
  });

  describe('findBySlug', () => {
    it('should return workspace by unique slug', async () => {
      const mockWorkspace = { id: 'ws-1', name: 'WS 1', slug: 'my-slug' };
      prisma.workspace.findFirst.mockResolvedValue(mockWorkspace);

      const res = await repository.findBySlug('my-slug');
      expect(res).toEqual(mockWorkspace);
      expect(prisma.workspace.findFirst).toHaveBeenCalledWith({
        where: { slug: 'my-slug', archivedAt: null },
      });
    });
  });

  describe('existsBySlug', () => {
    it('should return true when count > 0', async () => {
      prisma.workspace.count.mockResolvedValue(1);

      const res = await repository.existsBySlug('existing-slug');
      expect(res).toBe(true);
      expect(prisma.workspace.count).toHaveBeenCalledWith({
        where: { slug: 'existing-slug' },
      });
    });

    it('should return false when count === 0', async () => {
      prisma.workspace.count.mockResolvedValue(0);

      const res = await repository.existsBySlug('free-slug');
      expect(res).toBe(false);
    });
  });

  describe('findUserWorkspacesPage', () => {
    it('should return workspaces mapped with user role', async () => {
      const rawWorkspaces = [
        {
          id: 'ws-1',
          name: 'WS 1',
          members: [{ role: WorkspaceRole.admin }],
        },
        {
          id: 'ws-2',
          name: 'WS 2',
          members: [],
        },
      ];

      prisma.workspace.findMany.mockResolvedValue(rawWorkspaces);

      const res = await repository.findUserWorkspacesPage('u-1', 'ws-1', 20);

      expect(res).toEqual([
        { id: 'ws-1', name: 'WS 1', role: WorkspaceRole.admin },
        { id: 'ws-2', name: 'WS 2', role: WorkspaceRole.viewer },
      ]);
      expect(prisma.workspace.findMany).toHaveBeenCalledWith({
        where: {
          archivedAt: null,
          members: { some: { userId: 'u-1' } },
        },
        include: {
          members: {
            where: { userId: 'u-1' },
            select: { role: true },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 21,
        cursor: { id: 'ws-1' },
        skip: 1,
      });
    });

    it('should omit cursor when not provided', async () => {
      prisma.workspace.findMany.mockResolvedValue([]);

      await repository.findUserWorkspacesPage('u-1', undefined, 20);

      expect(prisma.workspace.findMany).toHaveBeenCalledWith(
        expect.not.objectContaining({ cursor: expect.anything() }),
      );
    });

    it('should retry without cursor when the cursor row no longer exists', async () => {
      const p2025Error = new Prisma.PrismaClientKnownRequestError(
        'Record not found',
        { code: 'P2025', clientVersion: '5.0.0' },
      );
      prisma.workspace.findMany
        .mockRejectedValueOnce(p2025Error)
        .mockResolvedValueOnce([]);

      const res = await repository.findUserWorkspacesPage('u-1', 'stale', 20);

      expect(prisma.workspace.findMany).toHaveBeenCalledTimes(2);
      expect(res).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update workspace', async () => {
      const updated = { id: 'ws-1', name: 'Updated' };
      prisma.workspace.update.mockResolvedValue(updated);

      const res = await repository.update('ws-1', { name: 'Updated' });

      expect(prisma.workspace.update).toHaveBeenCalledWith({
        where: { id: 'ws-1' },
        data: { name: 'Updated' },
      });
      expect(res).toEqual(updated);
    });
  });

  describe('archive', () => {
    it('should set archivedAt on workspace', async () => {
      prisma.workspace.update.mockResolvedValue({ id: 'ws-1' });

      await repository.archive('ws-1');

      expect(prisma.workspace.update).toHaveBeenCalledWith({
        where: { id: 'ws-1' },
        data: { archivedAt: expect.any(Date) },
      });
    });
  });
});
