import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { ChecklistService } from '../../services/checklist.service';
import { ChecklistRepository } from '../../repositories/checklist.repository';
import { CardRepository } from '../../../card/repositories/card.repository';
import { BoardRepository } from '../../../board/repositories/board.repository';
import { LexorankService } from '../../../lexorank/services/lexorank.service';
import { EntityNotFoundException } from '../../../../../common/exceptions/app.exception';
import { CHECKLIST_EVENTS } from '../../events/checklist.events';

describe('ChecklistService', () => {
  let service: ChecklistService;
  let checklistRepo: DeepMockProxy<ChecklistRepository>;
  let cardRepo: DeepMockProxy<CardRepository>;
  let boardRepo: DeepMockProxy<BoardRepository>;
  let lexorank: LexorankService;
  let eventEmitter: DeepMockProxy<EventEmitter2>;

  const ARGS = ['ws-uuid', 'board-uuid', 'card-uuid'] as const;
  const USER = 'user-uuid';

  const mockChecklist = {
    id: 'checklist-uuid',
    cardId: 'card-uuid',
    title: 'Definition of Done',
    rank: '0|g0000:',
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [],
  };

  const mockItem = {
    id: 'item-uuid',
    checklistId: 'checklist-uuid',
    content: 'Code reviewed',
    isDone: false,
    rank: '0|h000zz:',
    createdAt: new Date(),
    updatedAt: new Date(),
    checklist: mockChecklist,
  };

  beforeEach(async () => {
    checklistRepo = mockDeep<ChecklistRepository>();
    cardRepo = mockDeep<CardRepository>();
    boardRepo = mockDeep<BoardRepository>();
    eventEmitter = mockDeep<EventEmitter2>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChecklistService,
        LexorankService,
        { provide: ChecklistRepository, useValue: checklistRepo },
        { provide: CardRepository, useValue: cardRepo },
        { provide: BoardRepository, useValue: boardRepo },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<ChecklistService>(ChecklistService);
    lexorank = module.get<LexorankService>(LexorankService);

    // Default happy-path verification stubs
    boardRepo.findById.mockResolvedValue({ id: 'board-uuid' } as any);
    cardRepo.findActiveById.mockResolvedValue({ id: 'card-uuid' } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw EntityNotFoundException when board does not exist', async () => {
    boardRepo.findById.mockResolvedValue(null);

    await expect(
      service.getChecklists(...ARGS),
    ).rejects.toThrow(EntityNotFoundException);
  });

  it('should throw EntityNotFoundException when card does not exist', async () => {
    cardRepo.findActiveById.mockResolvedValue(null);

    await expect(
      service.getChecklists(...ARGS),
    ).rejects.toThrow(EntityNotFoundException);
  });

  describe('createChecklist', () => {
    it('should create with initial rank when the card has no checklists and emit checklist.created', async () => {
      checklistRepo.findChecklistsByCard.mockResolvedValue([]);
      checklistRepo.createChecklist.mockResolvedValue(mockChecklist);

      const result = await service.createChecklist(
        ...ARGS,
        { title: 'Definition of Done' },
        USER,
      );

      expect(checklistRepo.createChecklist).toHaveBeenCalledWith({
        cardId: 'card-uuid',
        title: 'Definition of Done',
        rank: lexorank.getInitialRank(),
      });
      expect(result).toEqual(mockChecklist);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        CHECKLIST_EVENTS.created,
        expect.objectContaining({
          checklist: mockChecklist,
          boardId: 'board-uuid',
          createdBy: USER,
        }),
      );
    });

    it('should append rank after the last existing checklist', async () => {
      const last = {
        ...mockChecklist,
        id: 'last-checklist',
        rank: lexorank.getInitialRank(),
      };
      checklistRepo.findChecklistsByCard.mockResolvedValue([last]);
      checklistRepo.createChecklist.mockResolvedValue(mockChecklist);

      await service.createChecklist(
        ...ARGS,
        { title: 'Second checklist' },
        USER,
      );

      expect(checklistRepo.createChecklist).toHaveBeenCalledWith({
        cardId: 'card-uuid',
        title: 'Second checklist',
        rank: lexorank.getRankBetween(last.rank, null),
      });
    });
  });

  describe('getChecklists', () => {
    it('should return ordered checklists for the card', async () => {
      checklistRepo.findChecklistsByCard.mockResolvedValue([mockChecklist]);

      const result = await service.getChecklists(...ARGS);

      expect(result).toEqual([mockChecklist]);
      expect(checklistRepo.findChecklistsByCard).toHaveBeenCalledWith(
        'card-uuid',
      );
    });
  });

  describe('renameChecklist', () => {
    it('should update the checklist and emit checklist.updated', async () => {
      checklistRepo.findActiveChecklist.mockResolvedValue(mockChecklist);
      checklistRepo.updateChecklist.mockResolvedValue({
        ...mockChecklist,
        title: 'Renamed',
      });

      const result = await service.renameChecklist(
        ...ARGS,
        'checklist-uuid',
        { title: 'Renamed' },
        USER,
      );

      expect(checklistRepo.updateChecklist).toHaveBeenCalledWith(
        'checklist-uuid',
        { title: 'Renamed' },
      );
      expect(result.title).toBe('Renamed');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        CHECKLIST_EVENTS.updated,
        expect.objectContaining({
          checklistId: 'checklist-uuid',
          cardId: 'card-uuid',
          boardId: 'board-uuid',
          updatedBy: USER,
        }),
      );
    });

    it('should throw EntityNotFoundException on cross-card (cross-board) checklist access', async () => {
      checklistRepo.findActiveChecklist.mockResolvedValue({
        ...mockChecklist,
        cardId: 'other-card-uuid',
      });

      await expect(
        service.renameChecklist(
          ...ARGS,
          'checklist-uuid',
          { title: 'Hijack' },
          USER,
        ),
      ).rejects.toThrow(EntityNotFoundException);
      expect(checklistRepo.updateChecklist).not.toHaveBeenCalled();
    });
  });

  describe('deleteChecklist', () => {
    it('should hard delete the checklist and emit checklist.deleted', async () => {
      checklistRepo.findActiveChecklist.mockResolvedValue(mockChecklist);

      await service.deleteChecklist(...ARGS, 'checklist-uuid', USER);

      expect(checklistRepo.deleteChecklist).toHaveBeenCalledWith(
        'checklist-uuid',
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        CHECKLIST_EVENTS.deleted,
        expect.objectContaining({
          checklistId: 'checklist-uuid',
          cardId: 'card-uuid',
          boardId: 'board-uuid',
          deletedBy: USER,
        }),
      );
    });

    it('should throw EntityNotFoundException when checklist not found', async () => {
      checklistRepo.findActiveChecklist.mockResolvedValue(null);

      await expect(
        service.deleteChecklist(...ARGS, 'missing-checklist', USER),
      ).rejects.toThrow(EntityNotFoundException);
      expect(checklistRepo.deleteChecklist).not.toHaveBeenCalled();
    });
  });

  describe('addItem', () => {
    it('should create item appended after last and emit checklist.updated', async () => {
      const lastItem = { ...mockItem, id: 'last-item', rank: lexorank.getInitialRank() };
      checklistRepo.findActiveChecklist.mockResolvedValue({
        ...mockChecklist,
        items: [lastItem],
      });
      checklistRepo.createItem.mockResolvedValue(mockItem);

      const result = await service.addItem(
        ...ARGS,
        'checklist-uuid',
        { content: 'Code reviewed' },
        USER,
      );

      expect(checklistRepo.createItem).toHaveBeenCalledWith({
        checklistId: 'checklist-uuid',
        content: 'Code reviewed',
        rank: lexorank.getRankBetween(lastItem.rank, null),
      });
      expect(result).toEqual(mockItem);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        CHECKLIST_EVENTS.updated,
        expect.objectContaining({ checklistId: 'checklist-uuid' }),
      );
    });

    it('should use initial rank when the checklist has no items', async () => {
      checklistRepo.findActiveChecklist.mockResolvedValue(mockChecklist);
      checklistRepo.createItem.mockResolvedValue(mockItem);

      await service.addItem(
        ...ARGS,
        'checklist-uuid',
        { content: 'First item' },
        USER,
      );

      expect(checklistRepo.createItem).toHaveBeenCalledWith({
        checklistId: 'checklist-uuid',
        content: 'First item',
        rank: lexorank.getInitialRank(),
      });
    });
  });

  describe('updateItem', () => {
    it('should patch item content/isDone and emit checklist.updated', async () => {
      checklistRepo.findItem.mockResolvedValue(mockItem);
      checklistRepo.updateItem.mockResolvedValue({
        ...mockItem,
        isDone: true,
      });

      const result = await service.updateItem(
        ...ARGS,
        'checklist-uuid',
        'item-uuid',
        { isDone: true },
        USER,
      );

      expect(checklistRepo.updateItem).toHaveBeenCalledWith('item-uuid', {
        isDone: true,
      });
      expect(result.isDone).toBe(true);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        CHECKLIST_EVENTS.updated,
        expect.objectContaining({
          checklistId: 'checklist-uuid',
          updatedBy: USER,
        }),
      );
    });

    it('should throw EntityNotFoundException when item belongs to another checklist', async () => {
      checklistRepo.findItem.mockResolvedValue({
        ...mockItem,
        checklistId: 'other-checklist',
      });

      await expect(
        service.updateItem(
          ...ARGS,
          'checklist-uuid',
          'item-uuid',
          { isDone: true },
          USER,
        ),
      ).rejects.toThrow(EntityNotFoundException);
      expect(checklistRepo.updateItem).not.toHaveBeenCalled();
    });
  });

  describe('removeItem', () => {
    it('should delete the item and emit checklist.updated', async () => {
      checklistRepo.findItem.mockResolvedValue(mockItem);

      await service.removeItem(
        ...ARGS,
        'checklist-uuid',
        'item-uuid',
        USER,
      );

      expect(checklistRepo.deleteItem).toHaveBeenCalledWith('item-uuid');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        CHECKLIST_EVENTS.updated,
        expect.objectContaining({ checklistId: 'checklist-uuid' }),
      );
    });

    it('should throw EntityNotFoundException when item not found', async () => {
      checklistRepo.findItem.mockResolvedValue(null);

      await expect(
        service.removeItem(...ARGS, 'checklist-uuid', 'missing-item', USER),
      ).rejects.toThrow(EntityNotFoundException);
      expect(checklistRepo.deleteItem).not.toHaveBeenCalled();
    });
  });
});
