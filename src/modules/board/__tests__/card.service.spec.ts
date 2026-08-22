import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { CardService } from '../services/card.service';
import { CardRepository } from '../repositories/card.repository';
import { BoardRepository } from '../repositories/board.repository';
import { ListRepository } from '../repositories/list.repository';
import { LabelRepository } from '../repositories/label.repository';
import { WorkspaceService } from '../../workspace/services/workspace.service';
import { LexorankService } from '../services/lexorank.service';
import { EntityNotFoundException } from '../../../common/exceptions/app.exception';

describe('CardService', () => {
  let service: CardService;
  let cardRepo: DeepMockProxy<CardRepository>;
  let boardRepo: DeepMockProxy<BoardRepository>;
  let listRepo: DeepMockProxy<ListRepository>;
  let labelRepo: DeepMockProxy<LabelRepository>;
  let workspaceService: DeepMockProxy<WorkspaceService>;
  let lexorankService: LexorankService;
  let eventEmitter: DeepMockProxy<EventEmitter2>;

  beforeEach(async () => {
    cardRepo = mockDeep<CardRepository>();
    boardRepo = mockDeep<BoardRepository>();
    listRepo = mockDeep<ListRepository>();
    labelRepo = mockDeep<LabelRepository>();
    workspaceService = mockDeep<WorkspaceService>();
    eventEmitter = mockDeep<EventEmitter2>();

    boardRepo.findById.mockResolvedValue({ id: 'board-uuid' } as any);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CardService,
        LexorankService,
        { provide: CardRepository, useValue: cardRepo },
        { provide: BoardRepository, useValue: boardRepo },
        { provide: ListRepository, useValue: listRepo },
        { provide: LabelRepository, useValue: labelRepo },
        { provide: WorkspaceService, useValue: workspaceService },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<CardService>(CardService);
    lexorankService = module.get<LexorankService>(LexorankService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create card in existing list and emit card.created event', async () => {
      listRepo.findActiveById.mockResolvedValue({
        id: 'list-uuid',
        boardId: 'board-uuid',
      } as any);

      cardRepo.findLastInList.mockResolvedValue(null);

      const mockCardWithDetails = {
        id: 'card-uuid',
        listId: 'list-uuid',
        title: 'Fix Login Bug',
        description: null,
        rank: lexorankService.getInitialRank(),
        dueDate: null,
        isComplete: false,
        coverImageUrl: null,
        createdBy: 'user-uuid',
        createdAt: new Date(),
        updatedAt: new Date(),
        archivedAt: null,
        assignees: [],
        labels: [],
      };

      cardRepo.create.mockResolvedValue(mockCardWithDetails);

      const result = await service.create(
        'board-uuid',
        'ws-uuid',
        'list-uuid',
        { title: 'Fix Login Bug' },
        'user-uuid',
      );

      expect(result).toEqual(mockCardWithDetails);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'card.created',
        expect.any(Object),
      );
    });

    it('should throw EntityNotFoundException if list is not found', async () => {
      listRepo.findActiveById.mockResolvedValue(null);

      await expect(
        service.create(
          'board-uuid',
          'ws-uuid',
          'nonexistent-list',
          { title: 'Fix Bug' },
          'user-uuid',
        ),
      ).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe('move', () => {
    it('should move card to target list and calculate new rank', async () => {
      cardRepo.findActiveById.mockResolvedValue({
        id: 'card-uuid',
        listId: 'list-1',
        rank: '0|i00000:',
      } as any);

      listRepo.findActiveById.mockResolvedValue({
        id: 'list-2',
        boardId: 'board-uuid',
      } as any);

      cardRepo.moveCard.mockResolvedValue({
        id: 'card-uuid',
        listId: 'list-2',
        rank: '0|i00004:',
      } as any);

      const result = await service.move(
        'board-uuid',
        'ws-uuid',
        'card-uuid',
        {
          targetListId: 'list-2',
          prevRank: '0|i00000:',
          nextRank: '0|i00008:',
        },
        'user-uuid',
      );

      expect(cardRepo.moveCard).toHaveBeenCalledWith(
        'card-uuid',
        'list-2',
        expect.any(String),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'card.moved',
        expect.any(Object),
      );
      expect(result).toBeDefined();
    });
  });

  describe('addLabel', () => {
    it('should add workspace-level label to card', async () => {
      cardRepo.findActiveById.mockResolvedValue({ id: 'card-uuid' } as any);
      labelRepo.findById.mockResolvedValue({
        id: 'label-1',
        workspaceId: 'ws-uuid',
        boardId: null,
      } as any);
      cardRepo.addLabel.mockResolvedValue();

      await service.addLabel(
        'board-uuid',
        'ws-uuid',
        'card-uuid',
        'label-1',
      );

      expect(cardRepo.addLabel).toHaveBeenCalledWith('card-uuid', 'label-1');
    });

    it('should add board-specific label to card', async () => {
      cardRepo.findActiveById.mockResolvedValue({ id: 'card-uuid' } as any);
      labelRepo.findById.mockResolvedValue({
        id: 'label-2',
        workspaceId: 'ws-uuid',
        boardId: 'board-uuid',
      } as any);
      cardRepo.addLabel.mockResolvedValue();

      await service.addLabel(
        'board-uuid',
        'ws-uuid',
        'card-uuid',
        'label-2',
      );

      expect(cardRepo.addLabel).toHaveBeenCalledWith('card-uuid', 'label-2');
    });
  });

  describe('unarchive', () => {
    it('should unarchive a card and emit card.unarchived event', async () => {
      cardRepo.findByIdIncludingArchived.mockResolvedValue({
        id: 'card-uuid',
        listId: 'list-uuid',
      } as any);
      cardRepo.unarchive.mockResolvedValue({
        id: 'card-uuid',
        listId: 'list-uuid',
        archivedAt: null,
      } as any);

      const result = await service.unarchive(
        'board-uuid',
        'ws-uuid',
        'card-uuid',
        'user-uuid',
      );

      expect(cardRepo.unarchive).toHaveBeenCalledWith('card-uuid');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'card.unarchived',
        expect.any(Object),
      );
      expect(result.archivedAt).toBeNull();
    });

    it('should throw EntityNotFoundException when card does not exist', async () => {
      cardRepo.findByIdIncludingArchived.mockResolvedValue(null);

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
