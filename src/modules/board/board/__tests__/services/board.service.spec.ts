import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { BoardService } from '../../services/board.service';
import { BoardRepository } from '../../repositories/board.repository';
import { LabelRepository } from '../../../label/repositories/label.repository';
import { ActivityRepository } from '../../../../activity/repositories/activity.repository';
import { EntityNotFoundException } from '../../../../../common/exceptions/app.exception';

describe('BoardService', () => {
  let service: BoardService;
  let boardRepo: DeepMockProxy<BoardRepository>;
  let labelRepo: DeepMockProxy<LabelRepository>;
  let activityRepo: DeepMockProxy<ActivityRepository>;
  let eventEmitter: DeepMockProxy<EventEmitter2>;

  beforeEach(async () => {
    boardRepo = mockDeep<BoardRepository>();
    labelRepo = mockDeep<LabelRepository>();
    activityRepo = mockDeep<ActivityRepository>();
    eventEmitter = mockDeep<EventEmitter2>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BoardService,
        { provide: BoardRepository, useValue: boardRepo },
        { provide: LabelRepository, useValue: labelRepo },
        { provide: ActivityRepository, useValue: activityRepo },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<BoardService>(BoardService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('create', () => {
    it('should create a board and emit board.created event', async () => {
      const mockBoard = {
        id: 'board-uuid',
        workspaceId: 'ws-uuid',
        title: 'Sprint 1',
        description: 'First sprint',
        backgroundColor: '#1A1A2E',
        createdBy: 'user-uuid',
        createdAt: new Date(),
        updatedAt: new Date(),
        archivedAt: null,
      };

      boardRepo.create.mockResolvedValue(mockBoard);

      const result = await service.create(
        'ws-uuid',
        { title: 'Sprint 1', description: 'First sprint' },
        'user-uuid',
      );

      expect(result).toEqual(mockBoard);
      expect(boardRepo.create).toHaveBeenCalledWith({
        workspaceId: 'ws-uuid',
        title: 'Sprint 1',
        description: 'First sprint',
        backgroundColor: '#1A1A2E',
        createdBy: 'user-uuid',
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'board.created',
        expect.any(Object),
      );
    });
  });

  describe('getBoardWithContent', () => {
    it('should return board with full content and pagination meta when found', async () => {
      const mockFullBoard = {
        id: 'board-uuid',
        workspaceId: 'ws-uuid',
        title: 'Sprint 1',
        description: null,
        backgroundColor: '#1A1A2E',
        createdBy: 'user-uuid',
        createdAt: new Date(),
        updatedAt: new Date(),
        archivedAt: null,
        isStarred: true,
        lists: [],
        labels: [],
      };

      boardRepo.findByIdWithContent.mockResolvedValue(mockFullBoard as any);
      boardRepo.countLists.mockResolvedValue(0);
      boardRepo.countCards.mockResolvedValue(0);
      labelRepo.findAvailableLabels.mockResolvedValue([]);

      const result = await service.getBoardWithContent(
        'board-uuid',
        'ws-uuid',
        'user-uuid',
      );

      expect(result).toEqual({
        ...mockFullBoard,
        pagination: {
          listPage: 1,
          listPageSize: 50,
          totalLists: 0,
          totalPages: 1,
          cardPageSize: 50,
          totalCards: 0,
        },
      });
    });

    it('should calculate custom pagination offsets when query options provided', async () => {
      const mockFullBoard = {
        id: 'board-uuid',
        workspaceId: 'ws-uuid',
        title: 'Sprint 1',
        lists: [],
        labels: [],
      };

      boardRepo.findByIdWithContent.mockResolvedValue(mockFullBoard as any);
      boardRepo.countLists.mockResolvedValue(105);
      boardRepo.countCards.mockResolvedValue(200);
      labelRepo.findAvailableLabels.mockResolvedValue([]);

      const result = await service.getBoardWithContent(
        'board-uuid',
        'ws-uuid',
        'user-uuid',
        { listPage: 2, listPageSize: 10, cardPageSize: 20 },
      );

      expect(boardRepo.findByIdWithContent).toHaveBeenCalledWith(
        'board-uuid',
        'user-uuid',
        { listSkip: 10, listTake: 10, cardSkip: 0, cardTake: 20 },
        'ws-uuid',
      );
      expect(result.pagination.totalPages).toBe(11);
    });

    it('should throw EntityNotFoundException when board does not exist', async () => {
      boardRepo.findByIdWithContent.mockResolvedValue(null);

      await expect(
        service.getBoardWithContent('nonexistent-uuid', 'ws-uuid', 'user-uuid'),
      ).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe('listWorkspaceBoards', () => {
    it('should list all workspace boards for user', async () => {
      const mockBoards = [{ id: 'b-1' }];
      boardRepo.findWorkspaceBoards.mockResolvedValue(mockBoards as any);

      const result = await service.listWorkspaceBoards('ws-1', 'u-1');

      expect(result).toEqual(mockBoards);
      expect(boardRepo.findWorkspaceBoards).toHaveBeenCalledWith('ws-1', 'u-1');
    });
  });

  describe('update', () => {
    it('should update board and emit board.updated', async () => {
      const mockBoard = { id: 'b-1', title: 'Old' };
      const updatedBoard = { id: 'b-1', title: 'New' };
      boardRepo.findById.mockResolvedValue(mockBoard as any);
      boardRepo.update.mockResolvedValue(updatedBoard as any);

      const result = await service.update('b-1', 'ws-1', { title: 'New', description: 'Desc', backgroundColor: '#fff' }, 'u-1');

      expect(result).toEqual(updatedBoard);
      expect(boardRepo.update).toHaveBeenCalledWith('b-1', {
        title: 'New',
        description: 'Desc',
        backgroundColor: '#fff',
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith('board.updated', expect.any(Object));
    });

    it('should throw EntityNotFoundException if board not found during update', async () => {
      boardRepo.findById.mockResolvedValue(null);

      await expect(service.update('b-99', 'ws-1', { title: 'New' }, 'u-1')).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe('archive', () => {
    it('should archive board and emit board.archived', async () => {
      boardRepo.findById.mockResolvedValue({ id: 'b-1' } as any);
      boardRepo.archive.mockResolvedValue({ id: 'b-1' } as any);

      await service.archive('b-1', 'ws-1', 'u-1');

      expect(boardRepo.archive).toHaveBeenCalledWith('b-1');
      expect(eventEmitter.emit).toHaveBeenCalledWith('board.archived', expect.any(Object));
    });

    it('should throw EntityNotFoundException if board not found during archive', async () => {
      boardRepo.findById.mockResolvedValue(null);

      await expect(service.archive('b-99', 'ws-1', 'u-1')).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe('unarchive', () => {
    it('should unarchive a board and emit board.unarchived event', async () => {
      const mockBoard = {
        id: 'board-uuid',
        workspaceId: 'ws-uuid',
        title: 'Sprint 1',
        archivedAt: new Date(),
      };

      boardRepo.findByIdIncludingArchived.mockResolvedValue(mockBoard as any);
      boardRepo.unarchive.mockResolvedValue({
        ...mockBoard,
        archivedAt: null,
      } as any);

      const result = await service.unarchive(
        'board-uuid',
        'ws-uuid',
        'user-uuid',
      );

      expect(boardRepo.unarchive).toHaveBeenCalledWith('board-uuid');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'board.unarchived',
        expect.any(Object),
      );
      expect(result.archivedAt).toBeNull();
    });

    it('should throw EntityNotFoundException when board does not exist', async () => {
      boardRepo.findByIdIncludingArchived.mockResolvedValue(null);

      await expect(
        service.unarchive('nonexistent-uuid', 'ws-uuid', 'user-uuid'),
      ).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe('starBoard & unstarBoard', () => {
    it('should star a board if found', async () => {
      boardRepo.findById.mockResolvedValue({ id: 'board-uuid' } as any);
      boardRepo.starBoard.mockResolvedValue();

      await service.starBoard('user-uuid', 'board-uuid', 'ws-uuid');

      expect(boardRepo.starBoard).toHaveBeenCalledWith(
        'user-uuid',
        'board-uuid',
      );
    });

    it('should throw EntityNotFoundException when starring nonexistent board', async () => {
      boardRepo.findById.mockResolvedValue(null);

      await expect(
        service.starBoard('user-uuid', 'board-uuid', 'ws-uuid'),
      ).rejects.toThrow(EntityNotFoundException);
    });

    it('should unstar a board if found', async () => {
      boardRepo.findById.mockResolvedValue({ id: 'board-uuid' } as any);
      boardRepo.unstarBoard.mockResolvedValue();

      await service.unstarBoard('user-uuid', 'board-uuid', 'ws-uuid');

      expect(boardRepo.unstarBoard).toHaveBeenCalledWith('user-uuid', 'board-uuid');
    });

    it('should throw EntityNotFoundException when unstarring nonexistent board', async () => {
      boardRepo.findById.mockResolvedValue(null);

      await expect(
        service.unstarBoard('user-uuid', 'board-uuid', 'ws-uuid'),
      ).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe('Activities', () => {
    it('should get board activities if board found', async () => {
      boardRepo.findById.mockResolvedValue({ id: 'b-1' } as any);
      activityRepo.findByBoardId.mockResolvedValue([{ id: 'act-1' }] as any);

      const result = await service.getBoardActivities('b-1', 'ws-1', 25);

      expect(activityRepo.findByBoardId).toHaveBeenCalledWith('b-1', 25);
      expect(result).toEqual([{ id: 'act-1' }]);
    });

    it('should throw EntityNotFoundException if board not found when getting activities', async () => {
      boardRepo.findById.mockResolvedValue(null);

      await expect(service.getBoardActivities('b-99', 'ws-1')).rejects.toThrow(EntityNotFoundException);
    });
  });
});
