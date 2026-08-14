import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { ListService } from '../services/list.service';
import { ListRepository } from '../repositories/list.repository';
import { BoardRepository } from '../repositories/board.repository';
import { LexorankService } from '../services/lexorank.service';
import { EntityNotFoundException } from '../../../common/exceptions/app.exception';

describe('ListService', () => {
  let service: ListService;
  let listRepo: DeepMockProxy<ListRepository>;
  let boardRepo: DeepMockProxy<BoardRepository>;
  let lexorankService: LexorankService;
  let eventEmitter: DeepMockProxy<EventEmitter2>;

  beforeEach(async () => {
    listRepo = mockDeep<ListRepository>();
    boardRepo = mockDeep<BoardRepository>();
    eventEmitter = mockDeep<EventEmitter2>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListService,
        LexorankService,
        { provide: ListRepository, useValue: listRepo },
        { provide: BoardRepository, useValue: boardRepo },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<ListService>(ListService);
    lexorankService = module.get<LexorankService>(LexorankService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create first list in board with initial rank', async () => {
      boardRepo.findById.mockResolvedValue({
        id: 'board-uuid',
        workspaceId: 'ws-uuid',
      } as any);
      listRepo.findLastInBoard.mockResolvedValue(null);

      const mockList = {
        id: 'list-uuid',
        boardId: 'board-uuid',
        title: 'To Do',
        rank: lexorankService.getInitialRank(),
        createdAt: new Date(),
        updatedAt: new Date(),
        archivedAt: null,
      };

      listRepo.create.mockResolvedValue(mockList);

      const result = await service.create(
        'board-uuid',
        'ws-uuid',
        { title: 'To Do' },
        'user-uuid',
      );

      expect(result).toEqual(mockList);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'list.created',
        expect.any(Object),
      );
    });

    it('should throw EntityNotFoundException if board does not exist', async () => {
      boardRepo.findById.mockResolvedValue(null);

      await expect(
        service.create(
          'nonexistent-uuid',
          'ws-uuid',
          { title: 'To Do' },
          'user-uuid',
        ),
      ).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe('move', () => {
    it('should recalculate rank and move list', async () => {
      boardRepo.findById.mockResolvedValue({
        id: 'board-uuid',
        workspaceId: 'ws-uuid',
      } as any);
      listRepo.findActiveById.mockResolvedValue({
        id: 'list-uuid',
        boardId: 'board-uuid',
        rank: '0|i00000:',
      } as any);

      listRepo.update.mockResolvedValue({
        id: 'list-uuid',
        boardId: 'board-uuid',
        rank: '0|i00004:',
      } as any);

      const result = await service.move(
        'board-uuid',
        'ws-uuid',
        'list-uuid',
        { prevRank: '0|i00000:', nextRank: '0|i00008:' },
        'user-uuid',
      );

      expect(listRepo.update).toHaveBeenCalledWith('list-uuid', {
        rank: expect.any(String),
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'list.moved',
        expect.any(Object),
      );
    });
  });

  describe('unarchive', () => {
    it('should unarchive a list and emit list.unarchived event', async () => {
      boardRepo.findById.mockResolvedValue({
        id: 'board-uuid',
        workspaceId: 'ws-uuid',
      } as any);
      const mockList = {
        id: 'list-uuid',
        boardId: 'board-uuid',
        title: 'To Do',
        rank: '0|i00000:',
        createdAt: new Date(),
        updatedAt: new Date(),
        archivedAt: new Date(),
      };

      listRepo.findByIdIncludingArchived.mockResolvedValue(mockList);
      listRepo.unarchive.mockResolvedValue({
        ...mockList,
        archivedAt: null,
      });

      const result = await service.unarchive(
        'board-uuid',
        'ws-uuid',
        'list-uuid',
        'user-uuid',
      );

      expect(listRepo.unarchive).toHaveBeenCalledWith('list-uuid');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'list.unarchived',
        expect.any(Object),
      );
      expect(result.archivedAt).toBeNull();
    });

    it('should throw EntityNotFoundException when list does not exist', async () => {
      boardRepo.findById.mockResolvedValue({
        id: 'board-uuid',
        workspaceId: 'ws-uuid',
      } as any);
      listRepo.findByIdIncludingArchived.mockResolvedValue(null);

      await expect(
        service.unarchive(
          'board-uuid',
          'ws-uuid',
          'nonexistent-uuid',
          'user-uuid',
        ),
      ).rejects.toThrow(EntityNotFoundException);
    });
  });
});
