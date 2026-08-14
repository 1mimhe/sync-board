import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { BoardService } from '../services/board.service';
import { BoardRepository } from '../repositories/board.repository';
import { LabelRepository } from '../repositories/label.repository';
import { ActivityRepository } from '../repositories/activity.repository';
import { EntityNotFoundException } from '../../../common/exceptions/app.exception';

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

  it('should be defined', () => {
    expect(service).toBeDefined();
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
      expect(boardRepo.findByIdWithContent).toHaveBeenCalledWith(
        'board-uuid',
        'user-uuid',
        { listSkip: 0, listTake: 50, cardSkip: 0, cardTake: 50 },
        'ws-uuid',
      );
    });

    it('should throw EntityNotFoundException when board does not exist', async () => {
      boardRepo.findByIdWithContent.mockResolvedValue(null);

      await expect(
        service.getBoardWithContent('nonexistent-uuid', 'ws-uuid', 'user-uuid'),
      ).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe('unarchive', () => {
    it('should unarchive a board and emit board.unarchived event', async () => {
      const mockBoard = {
        id: 'board-uuid',
        workspaceId: 'ws-uuid',
        title: 'Sprint 1',
        description: null,
        backgroundColor: '#1A1A2E',
        createdBy: 'user-uuid',
        createdAt: new Date(),
        updatedAt: new Date(),
        archivedAt: new Date(),
      };

      boardRepo.findByIdIncludingArchived.mockResolvedValue(mockBoard);
      boardRepo.unarchive.mockResolvedValue({
        ...mockBoard,
        archivedAt: null,
      });

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
  });

  describe('createLabel', () => {
    it('should create label for existing board', async () => {
      boardRepo.findById.mockResolvedValue({ id: 'board-uuid' } as any);
      const mockLabel = {
        id: 'label-uuid',
        workspaceId: 'ws-uuid',
        boardId: 'board-uuid',
        name: 'Bug',
        color: '#FF0000',
        createdAt: new Date(),
      };
      labelRepo.create.mockResolvedValue(mockLabel);

      const result = await service.createLabel('board-uuid', 'ws-uuid', {
        name: 'Bug',
        color: '#FF0000',
      });
      expect(result).toEqual(mockLabel);
      expect(labelRepo.create).toHaveBeenCalledWith({
        workspaceId: 'ws-uuid',
        boardId: 'board-uuid',
        name: 'Bug',
        color: '#FF0000',
      });
    });
  });
});
