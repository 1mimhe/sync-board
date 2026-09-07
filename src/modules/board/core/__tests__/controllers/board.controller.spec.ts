import { BoardController } from '../../controllers/board.controller';
import { BoardService } from '../../services/board.service';
import type { JwtPayload } from '../../../auth/interfaces/jwt-payload.interface';

describe('BoardController', () => {
  let controller: BoardController;
  let boardService: jest.Mocked<BoardService>;

  const mockUser: JwtPayload = {
    sub: 'user-uuid-1',
    email: 'user@test.com',
    jti: 'jti-1',
  };

  const mockBoard = {
    id: 'board-1',
    workspaceId: 'ws-1',
    title: 'Sprint Board',
    description: 'Sprint planning',
    backgroundColor: '#ffffff',
    createdBy: 'user-uuid-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    archivedAt: null,
  };

  const mockBoardWithContent = {
    ...mockBoard,
    isStarred: false,
    lists: [],
    labels: [],
    pagination: {
      listPage: 1,
      listPageSize: 10,
      totalLists: 0,
      totalPages: 0,
      cardPageSize: 20,
      totalCards: 0,
    },
  };

  const mockLabel = {
    id: 'label-1',
    workspaceId: 'ws-1',
    boardId: 'board-1',
    name: 'Bug',
    color: '#ff0000',
    createdAt: new Date(),
  };

  const mockActivity = {
    id: 'act-1',
    boardId: 'board-1',
    action: 'created' as any,
    entityType: 'card' as any,
    entityId: 'card-1',
    entityTitle: 'New Card',
    fromListId: null,
    toListId: null,
    details: null,
    createdAt: new Date(),
    user: {
      id: 'user-uuid-1',
      displayName: 'User',
      avatarUrl: null,
    },
  };

  beforeEach(() => {
    boardService = {
      create: jest.fn(),
      listWorkspaceBoards: jest.fn(),
      getBoardWithContent: jest.fn(),
      update: jest.fn(),
      archive: jest.fn(),
      unarchive: jest.fn(),
      starBoard: jest.fn(),
      unstarBoard: jest.fn(),
      getBoardActivities: jest.fn(),
    } as unknown as jest.Mocked<BoardService>;

    controller = new BoardController(boardService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('create', () => {
    it('should create board and map response', async () => {
      boardService.create.mockResolvedValue(mockBoard);

      const result = await controller.create(
        'ws-1',
        { title: 'Sprint Board' },
        mockUser,
      );

      expect(boardService.create).toHaveBeenCalledWith(
        'ws-1',
        { title: 'Sprint Board' },
        'user-uuid-1',
      );
      expect(result.id).toBe('board-1');
      expect(result.title).toBe('Sprint Board');
    });
  });

  describe('listWorkspaceBoards', () => {
    it('should list workspace boards with pagination mapping', async () => {
      const paginated = {
        items: [mockBoard],
        pagination: { cursor: 'board-1', hasMore: false },
      };
      boardService.listWorkspaceBoards.mockResolvedValue(paginated);

      const result = await controller.listWorkspaceBoards('ws-1', mockUser, {
        cursor: 'board-1',
        limit: 20,
      });

      expect(boardService.listWorkspaceBoards).toHaveBeenCalledWith(
        'ws-1',
        'user-uuid-1',
        { cursor: 'board-1', limit: 20 },
      );
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('board-1');
      expect(result.pagination).toEqual({ cursor: 'board-1', hasMore: false });
    });
  });

  describe('getOne', () => {
    it('should get board with full nested content and pagination', async () => {
      boardService.getBoardWithContent.mockResolvedValue(mockBoardWithContent);

      const result = await controller.getOne('ws-1', 'board-1', {}, mockUser);

      expect(boardService.getBoardWithContent).toHaveBeenCalledWith(
        'board-1',
        'ws-1',
        'user-uuid-1',
        {},
      );
      expect(result.id).toBe('board-1');
      expect(result.lists).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update board details', async () => {
      boardService.update.mockResolvedValue({
        ...mockBoard,
        title: 'Updated',
      });

      const result = await controller.update(
        'ws-1',
        'board-1',
        { title: 'Updated' },
        mockUser,
      );

      expect(boardService.update).toHaveBeenCalledWith(
        'board-1',
        'ws-1',
        { title: 'Updated' },
        'user-uuid-1',
      );
      expect(result.title).toBe('Updated');
    });
  });

  describe('archive and unarchive', () => {
    it('should archive board', async () => {
      boardService.archive.mockResolvedValue(undefined);

      await controller.archive('ws-1', 'board-1', mockUser);

      expect(boardService.archive).toHaveBeenCalledWith(
        'board-1',
        'ws-1',
        'user-uuid-1',
      );
    });

    it('should unarchive board and return mapped DTO', async () => {
      boardService.unarchive.mockResolvedValue(mockBoard);

      const result = await controller.unarchive('ws-1', 'board-1', mockUser);

      expect(boardService.unarchive).toHaveBeenCalledWith(
        'board-1',
        'ws-1',
        'user-uuid-1',
      );
      expect(result.id).toBe('board-1');
    });
  });

  describe('star and unstar', () => {
    it('should star board', async () => {
      boardService.starBoard.mockResolvedValue(undefined);

      await controller.star('ws-1', 'board-1', mockUser);

      expect(boardService.starBoard).toHaveBeenCalledWith(
        'user-uuid-1',
        'board-1',
        'ws-1',
      );
    });

    it('should unstar board', async () => {
      boardService.unstarBoard.mockResolvedValue(undefined);

      await controller.unstar('ws-1', 'board-1', mockUser);

      expect(boardService.unstarBoard).toHaveBeenCalledWith(
        'user-uuid-1',
        'board-1',
        'ws-1',
      );
    });
  });

  describe('activities', () => {
    it('should get board activities and map them with pagination', async () => {
      const paginated = {
        items: [mockActivity as any],
        pagination: { cursor: 'act-1', hasMore: false },
      };
      boardService.getBoardActivities.mockResolvedValue(paginated);

      const result = await controller.getActivities('ws-1', 'board-1', {
        limit: 20,
      });

      expect(boardService.getBoardActivities).toHaveBeenCalledWith(
        'board-1',
        'ws-1',
        { limit: 20 },
      );
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('act-1');
      expect(result.pagination).toEqual({ cursor: 'act-1', hasMore: false });
    });
  });

  describe('listArchived', () => {
    it('should list all archived boards and map response', async () => {
      boardService.listArchivedBoardsPaginated = jest.fn().mockResolvedValue({
        items: [mockBoard],
        pagination: { cursor: null, hasMore: false },
      });

      const result = await controller.listArchived('ws-1', {});

      expect(boardService.listArchivedBoardsPaginated).toHaveBeenCalledWith(
        'ws-1',
        {},
      );
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('board-1');
    });
  });
});
