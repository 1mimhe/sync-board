import { Test, TestingModule } from '@nestjs/testing';
import { BoardRepository } from '../../repositories/board.repository';
import { PrismaService } from '../../../../../common/database/prisma.service';

describe('BoardRepository', () => {
  let repository: BoardRepository;
  let prismaService: any;

  beforeEach(async () => {
    prismaService = {
      board: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      list: {
        count: jest.fn(),
      },
      card: {
        count: jest.fn(),
      },
      userStarredBoard: {
        upsert: jest.fn(),
        deleteMany: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BoardRepository,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    repository = module.get<BoardRepository>(BoardRepository);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('create', () => {
    it('should create board record', async () => {
      const mockBoard = { id: 'b-1', title: 'New Board', workspaceId: 'ws-1' };
      prismaService.board.create.mockResolvedValue(mockBoard);

      const result = await repository.create({
        title: 'New Board',
        workspaceId: 'ws-1',
        createdBy: 'u-1',
      });

      expect(prismaService.board.create).toHaveBeenCalledWith({
        data: { title: 'New Board', workspaceId: 'ws-1', createdBy: 'u-1' },
      });
      expect(result).toEqual(mockBoard);
    });
  });

  describe('findById and findByIdIncludingArchived', () => {
    it('should find active board by id with optional workspace filter', async () => {
      const mockBoard = { id: 'b-1', title: 'Board' };
      prismaService.board.findFirst.mockResolvedValue(mockBoard);

      const result = await repository.findById('b-1', 'ws-1');

      expect(prismaService.board.findFirst).toHaveBeenCalledWith({
        where: { id: 'b-1', archivedAt: null, workspaceId: 'ws-1' },
      });
      expect(result).toEqual(mockBoard);
    });

    it('should find board including archived', async () => {
      const mockBoard = { id: 'b-1', archivedAt: new Date() };
      prismaService.board.findFirst.mockResolvedValue(mockBoard);

      const result = await repository.findByIdIncludingArchived('b-1');

      expect(prismaService.board.findFirst).toHaveBeenCalledWith({
        where: { id: 'b-1' },
      });
      expect(result).toEqual(mockBoard);
    });
  });

  describe('findByIdWithContent', () => {
    it('should return null when board not found', async () => {
      prismaService.board.findFirst.mockResolvedValue(null);

      const result = await repository.findByIdWithContent('b-99', 'u-1');

      expect(result).toBeNull();
    });

    it('should return full board with mapped cardCount and isStarred boolean', async () => {
      const mockDbBoard = {
        id: 'b-1',
        title: 'Board',
        labels: [],
        lists: [
          {
            id: 'l-1',
            title: 'List 1',
            _count: { cards: 3 },
            cards: [],
          },
        ],
        starredBy: [{ userId: 'u-1' }],
      };
      prismaService.board.findFirst.mockResolvedValue(mockDbBoard);

      const result = await repository.findByIdWithContent('b-1', 'u-1', {
        listSkip: 0,
        listTake: 10,
      });

      expect(result).toBeDefined();
      expect(result?.isStarred).toBe(true);
      expect(result?.lists[0].cardCount).toBe(3);
    });
  });

  describe('counts', () => {
    it('should count active lists on board', async () => {
      prismaService.list.count.mockResolvedValue(5);

      const count = await repository.countLists('b-1');

      expect(prismaService.list.count).toHaveBeenCalledWith({
        where: { boardId: 'b-1', archivedAt: null },
      });
      expect(count).toBe(5);
    });

    it('should count active cards across all lists in board', async () => {
      prismaService.card.count.mockResolvedValue(12);

      const count = await repository.countCards('b-1');

      expect(prismaService.card.count).toHaveBeenCalledWith({
        where: { list: { boardId: 'b-1' }, archivedAt: null },
      });
      expect(count).toBe(12);
    });
  });

  describe('findWorkspaceBoardsPage', () => {
    it('should find a page of active workspace boards for user', async () => {
      const mockBoards = [{ id: 'b-1', title: 'Board 1' }];
      prismaService.board.findMany.mockResolvedValue(mockBoards);

      const result = await repository.findWorkspaceBoardsPage(
        'ws-1',
        'u-1',
        'prev-1',
        20,
      );

      expect(prismaService.board.findMany).toHaveBeenCalledWith({
        where: { workspaceId: 'ws-1', archivedAt: null },
        include: { starredBy: { where: { userId: 'u-1' } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 21,
        cursor: { id: 'prev-1' },
        skip: 1,
      });
      expect(result).toEqual(mockBoards);
    });

    it('should omit cursor when not provided', async () => {
      prismaService.board.findMany.mockResolvedValue([]);

      await repository.findWorkspaceBoardsPage('ws-1', 'u-1', undefined, 20);

      expect(prismaService.board.findMany).toHaveBeenCalledWith(
        expect.not.objectContaining({ cursor: expect.anything() }),
      );
    });
  });

  describe('update, archive, and unarchive', () => {
    it('should update board fields', async () => {
      const mockBoard = { id: 'b-1', title: 'Updated' };
      prismaService.board.update.mockResolvedValue(mockBoard);

      const result = await repository.update('b-1', { title: 'Updated' });

      expect(prismaService.board.update).toHaveBeenCalledWith({
        where: { id: 'b-1' },
        data: { title: 'Updated' },
      });
      expect(result).toEqual(mockBoard);
    });

    it('should archive board by setting archivedAt', async () => {
      const mockBoard = { id: 'b-1', archivedAt: expect.any(Date) };
      prismaService.board.update.mockResolvedValue(mockBoard);

      const result = await repository.archive('b-1');

      expect(prismaService.board.update).toHaveBeenCalledWith({
        where: { id: 'b-1' },
        data: { archivedAt: expect.any(Date) },
      });
      expect(result).toEqual(mockBoard);
    });

    it('should unarchive board by clearing archivedAt', async () => {
      const mockBoard = { id: 'b-1', archivedAt: null };
      prismaService.board.update.mockResolvedValue(mockBoard);

      const result = await repository.unarchive('b-1');

      expect(prismaService.board.update).toHaveBeenCalledWith({
        where: { id: 'b-1' },
        data: { archivedAt: null },
      });
      expect(result).toEqual(mockBoard);
    });
  });

  describe('starBoard, unstarBoard, isStarredByUser', () => {
    it('should star board with upsert', async () => {
      prismaService.userStarredBoard.upsert.mockResolvedValue({});

      await repository.starBoard('u-1', 'b-1');

      expect(prismaService.userStarredBoard.upsert).toHaveBeenCalledWith({
        where: { userId_boardId: { userId: 'u-1', boardId: 'b-1' } },
        create: { userId: 'u-1', boardId: 'b-1' },
        update: {},
      });
    });

    it('should unstar board with deleteMany', async () => {
      prismaService.userStarredBoard.deleteMany.mockResolvedValue({ count: 1 });

      await repository.unstarBoard('u-1', 'b-1');

      expect(prismaService.userStarredBoard.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u-1', boardId: 'b-1' },
      });
    });

    it('should return true when board is starred by user', async () => {
      prismaService.userStarredBoard.findUnique.mockResolvedValue({
        userId: 'u-1',
        boardId: 'b-1',
      });

      const result = await repository.isStarredByUser('u-1', 'b-1');

      expect(result).toBe(true);
    });

    it('should return false when board is not starred by user', async () => {
      prismaService.userStarredBoard.findUnique.mockResolvedValue(null);

      const result = await repository.isStarredByUser('u-1', 'b-1');

      expect(result).toBe(false);
    });
  });
});
