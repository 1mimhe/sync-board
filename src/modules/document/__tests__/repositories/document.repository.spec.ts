import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import {
  DocumentRepository,
  DOCUMENT_META_SELECT,
} from '../../repositories/document.repository';
import { PrismaService } from '../../../../common/database/prisma.service';

describe('DocumentRepository', () => {
  let repo: DocumentRepository;
  let prisma: {
    document: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    card: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
    };
    documentSnapshot: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      count: jest.Mock;
      deleteMany: jest.Mock;
    };
    $queryRaw: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      document: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      card: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      documentSnapshot: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        deleteMany: jest.fn(),
      },
      $queryRaw: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repo = module.get<DocumentRepository>(DocumentRepository);
  });

  it('create delegates to prisma.document.create', async () => {
    prisma.document.create.mockResolvedValue({ id: 'd-1' } as any);

    await repo.create({
      workspaceId: 'ws-1',
      title: 'Doc',
      createdBy: 'u-1',
    });

    expect(prisma.document.create).toHaveBeenCalledWith({
      data: { workspaceId: 'ws-1', title: 'Doc', createdBy: 'u-1' },
    });
  });

  it('findActiveById filters on active status and selects DOCUMENT_META_SELECT', async () => {
    prisma.document.findFirst.mockResolvedValue({ id: 'd-1' } as any);

    await repo.findActiveById('d-1');

    expect(prisma.document.findFirst).toHaveBeenCalledWith({
      where: { id: 'd-1', status: 'active' },
      select: DOCUMENT_META_SELECT,
    });
  });

  it('findWithState selects only id and yjsState', async () => {
    prisma.document.findFirst.mockResolvedValue({ id: 'd-1' } as any);

    await repo.findWithState('d-1');

    expect(prisma.document.findFirst).toHaveBeenCalledWith({
      where: { id: 'd-1', status: 'active' },
      select: { id: true, yjsState: true },
    });
  });

  it('findPage paginates with a cursor and selects DOCUMENT_META_SELECT', async () => {
    prisma.document.findMany.mockResolvedValue([{ id: 'd-1' }] as any);

    await repo.findPage('ws-1', 'd-1', 20);

    expect(prisma.document.findMany).toHaveBeenCalledWith({
      where: { workspaceId: 'ws-1', status: 'active' },
      select: {
        ...DOCUMENT_META_SELECT,
        parentCard: {
          select: { id: true, title: true },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 21,
      cursor: { id: 'd-1' },
      skip: 1,
    });
  });

  it('findPage omits the cursor when absent', async () => {
    prisma.document.findMany.mockResolvedValue([{ id: 'd-1' }] as any);

    await repo.findPage('ws-1', undefined, 20);

    expect(prisma.document.findMany).toHaveBeenCalledWith({
      where: { workspaceId: 'ws-1', status: 'active' },
      select: {
        ...DOCUMENT_META_SELECT,
        parentCard: {
          select: { id: true, title: true },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 21,
    });
  });

  it('findPage falls back to first page when cursor is unknown (P2025)', async () => {
    const p2025 = new Prisma.PrismaClientKnownRequestError(
      'An operation failed because it depends on one or more records that were required but not found.',
      { code: 'P2025', clientVersion: '5.0.0' },
    );
    prisma.document.findMany
      .mockRejectedValueOnce(p2025)
      .mockResolvedValueOnce([{ id: 'd-1' }] as any);

    const result = await repo.findPage('ws-1', 'd-missing', 20);

    expect(prisma.document.findMany).toHaveBeenCalledTimes(2);
    expect(prisma.document.findMany).toHaveBeenNthCalledWith(1, {
      where: { workspaceId: 'ws-1', status: 'active' },
      select: {
        ...DOCUMENT_META_SELECT,
        parentCard: {
          select: { id: true, title: true },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 21,
      cursor: { id: 'd-missing' },
      skip: 1,
    });
    expect(prisma.document.findMany).toHaveBeenNthCalledWith(2, {
      where: { workspaceId: 'ws-1', status: 'active' },
      select: {
        ...DOCUMENT_META_SELECT,
        parentCard: {
          select: { id: true, title: true },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 21,
    });
    expect(result).toEqual([{ id: 'd-1' }]);
  });

  it('findPage rethrows non-P2025 errors', async () => {
    const error = new Error('Database connection failed');
    prisma.document.findMany.mockRejectedValueOnce(error);

    await expect(repo.findPage('ws-1', 'd-1', 20)).rejects.toThrow(
      'Database connection failed',
    );
  });

  it('searchPage runs the full-text raw query without cursor', async () => {
    prisma.$queryRaw.mockResolvedValue([{ id: 'd-1' }]);

    const result = await repo.searchPage('ws-1', 'alpha', undefined, 20);

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(result).toEqual([{ id: 'd-1' }]);
  });

  it('searchPage paginates with a cursor document', async () => {
    prisma.document.findUnique.mockResolvedValue({
      id: 'd-cursor',
      workspaceId: 'ws-1',
      updatedAt: new Date(),
      status: 'active',
    } as any);
    prisma.$queryRaw.mockResolvedValue([{ id: 'd-2' }]);

    const result = await repo.searchPage('ws-1', 'alpha', 'd-cursor', 20);

    expect(prisma.document.findUnique).toHaveBeenCalledWith({
      where: { id: 'd-cursor' },
      select: { updatedAt: true, id: true, workspaceId: true, status: true },
    });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(result).toEqual([{ id: 'd-2' }]);
  });

  it('searchPage falls back to first page when cursor document is foreign', async () => {
    prisma.document.findUnique.mockResolvedValue({
      id: 'd-other',
      workspaceId: 'ws-other',
      updatedAt: new Date(),
      status: 'active',
    } as any);
    prisma.$queryRaw.mockResolvedValue([{ id: 'd-1' }]);

    const result = await repo.searchPage('ws-1', 'alpha', 'd-other', 20);

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(result).toEqual([{ id: 'd-1' }]);
  });

  it('searchPage falls back to first page when cursor document is not found', async () => {
    prisma.document.findUnique.mockResolvedValue(null);
    prisma.$queryRaw.mockResolvedValue([{ id: 'd-1' }]);

    const result = await repo.searchPage('ws-1', 'alpha', 'd-missing', 20);

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(result).toEqual([{ id: 'd-1' }]);
  });

  it('findByCard returns active documents of the card', async () => {
    prisma.document.findMany.mockResolvedValue([{ id: 'd-1' }] as any);

    await repo.findByCard('c-1');

    expect(prisma.document.findMany).toHaveBeenCalledWith({
      where: { parentCardId: 'c-1', status: 'active' },
      select: {
        ...DOCUMENT_META_SELECT,
        parentCard: {
          select: { id: true, title: true },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });
  });

  it('findByBoard returns active documents attached to cards on the board', async () => {
    prisma.document.findMany.mockResolvedValue([{ id: 'd-1' }] as any);

    await repo.findByBoard('ws-1', 'b-1');

    expect(prisma.document.findMany).toHaveBeenCalledWith({
      where: {
        workspaceId: 'ws-1',
        status: 'active',
        parentCard: {
          list: {
            boardId: 'b-1',
            archivedAt: null,
          },
          archivedAt: null,
        },
      },
      select: {
        ...DOCUMENT_META_SELECT,
        parentCard: {
          select: { id: true, title: true },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });
  });

  it('cardExistsInWorkspace returns true when the card exists', async () => {
    prisma.card.findFirst.mockResolvedValue({ id: 'c-1' } as any);

    await expect(repo.cardExistsInWorkspace('c-1', 'ws-1')).resolves.toBe(true);
  });

  it('cardExistsInWorkspace returns false when the card is absent', async () => {
    prisma.card.findFirst.mockResolvedValue(null);

    await expect(repo.cardExistsInWorkspace('c-1', 'ws-1')).resolves.toBe(
      false,
    );
  });

  it('findBoardIdByCard resolves the board through the card chain', async () => {
    prisma.card.findUnique.mockResolvedValue({
      list: { boardId: 'b-1' },
    } as any);

    await expect(repo.findBoardIdByCard('c-1')).resolves.toBe('b-1');
  });

  it('findBoardIdByCard returns null when the card is absent', async () => {
    prisma.card.findUnique.mockResolvedValue(null);

    await expect(repo.findBoardIdByCard('c-1')).resolves.toBeNull();
  });

  it('rename updates the title', async () => {
    prisma.document.update.mockResolvedValue({
      id: 'd-1',
      title: 'New',
    } as any);

    const result = await repo.rename('d-1', 'New');

    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: 'd-1' },
      data: { title: 'New' },
      select: DOCUMENT_META_SELECT,
    });
    expect(result.title).toBe('New');
  });

  it('archive switches the status', async () => {
    prisma.document.update.mockResolvedValue({
      id: 'd-1',
      status: 'archived',
    } as any);

    const result = await repo.archive('d-1');

    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: 'd-1' },
      data: { status: 'archived' },
      select: DOCUMENT_META_SELECT,
    });
    expect(result.status).toBe('archived');
  });

  it('saveState writes state bytes and preview', async () => {
    prisma.document.update.mockResolvedValue({ id: 'd-1' } as any);

    await repo.saveState('d-1', new Uint8Array([1, 2]), 'preview');

    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: 'd-1' },
      data: { yjsState: new Uint8Array([1, 2]), previewText: 'preview' },
    });
  });

  it('createSnapshot inserts a snapshot row', async () => {
    const data = { documentId: 'd-1', yjsState: new Uint8Array([1]) };
    prisma.documentSnapshot.create.mockResolvedValue({ id: 's-1' } as any);

    const result = await repo.createSnapshot(data as any);

    expect(prisma.documentSnapshot.create).toHaveBeenCalledWith({ data });
    expect(result).toEqual({ id: 's-1' });
  });

  it('findSnapshots returns the newest-first history', async () => {
    prisma.documentSnapshot.findMany.mockResolvedValue([{ id: 's-1' }] as any);

    await repo.findSnapshots('d-1');

    expect(prisma.documentSnapshot.findMany).toHaveBeenCalledWith({
      where: { documentId: 'd-1' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('findSnapshotById scopes the lookup to the document', async () => {
    prisma.documentSnapshot.findFirst.mockResolvedValue({ id: 's-1' } as any);

    const result = await repo.findSnapshotById('s-1', 'd-1');

    expect(prisma.documentSnapshot.findFirst).toHaveBeenCalledWith({
      where: { id: 's-1', documentId: 'd-1' },
    });
    expect(result).toEqual({ id: 's-1' });
  });
});
