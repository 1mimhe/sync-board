import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { CardService } from '../../services/card.service';
import { CardRepository } from '../../repositories/card.repository';
import { BoardRepository } from '../../../core/repositories/board.repository';
import { ListRepository } from '../../../list/repositories/list.repository';
import { LabelRepository } from '../../../label/repositories/label.repository';
import { WorkspaceService } from '../../../../workspace/services/workspace.service';
import { LexorankService } from '../../../lexorank/lexorank.service';
import { EntityNotFoundException } from '../../../../../common/exceptions/app.exception';
import { BadRequestException } from '@nestjs/common';
import { CARD_EVENTS } from '../../../card/events/card-events.constants';

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
    workspaceService.isUserMember.mockResolvedValue(true);
    labelRepo.findById.mockResolvedValue({
      id: 'lbl-1',
      workspaceId: 'ws-uuid',
      boardId: 'board-uuid',
    } as any);

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

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw EntityNotFoundException if board does not exist', async () => {
    boardRepo.findById.mockResolvedValue(null);

    await expect(
      service.getCardDetails('nonexistent-board', 'ws-uuid', 'card-1'),
    ).rejects.toThrow(EntityNotFoundException);
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
        description: 'Details',
        rank: lexorankService.getInitialRank(),
        dueDate: new Date(),
        isComplete: false,
        coverImageUrl: 'https://example.com/img.png',
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
        {
          title: 'Fix Login Bug',
          description: 'Details',
          dueDate: new Date().toISOString(),
          coverImageUrl: 'https://example.com/img.png',
          assigneeIds: ['u-1'],
          labelIds: ['lbl-1'],
        },
        'user-uuid',
      );

      expect(result).toEqual(mockCardWithDetails);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'card.created',
        expect.any(Object),
      );
    });

    it('should append card rank after last card in list', async () => {
      listRepo.findActiveById.mockResolvedValue({
        id: 'list-uuid',
        boardId: 'board-uuid',
      } as any);
      cardRepo.findLastInList.mockResolvedValue({
        id: 'card-0',
        rank: '0|h:',
      } as any);

      cardRepo.create.mockResolvedValue({ id: 'card-1' } as any);

      await service.create(
        'board-uuid',
        'ws-uuid',
        'list-uuid',
        { title: 'New Task' },
        'user-uuid',
      );

      expect(cardRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ rank: expect.any(String) }),
        undefined,
        undefined,
      );
    });

    it('should fall back to initial rank if rank calculation throws during create', async () => {
      listRepo.findActiveById.mockResolvedValue({
        id: 'list-uuid',
        boardId: 'board-uuid',
      } as any);
      cardRepo.findLastInList.mockResolvedValue({
        id: 'card-0',
        rank: 'invalid-rank-corrupt',
      } as any);

      cardRepo.create.mockResolvedValue({ id: 'card-1' } as any);

      await service.create(
        'board-uuid',
        'ws-uuid',
        'list-uuid',
        { title: 'New Task' },
        'user-uuid',
      );

      expect(cardRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ rank: lexorankService.getInitialRank() }),
        undefined,
        undefined,
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

    it('should throw BadRequestException if assignee is not a workspace member', async () => {
      listRepo.findActiveById.mockResolvedValue({ id: 'list-1' } as any);
      workspaceService.isUserMember.mockResolvedValue(false);

      await expect(
        service.create(
          'board-uuid',
          'ws-uuid',
          'list-1',
          { title: 'Task', assigneeIds: ['u-stranger'] },
          'user-uuid',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if label is not valid for board', async () => {
      listRepo.findActiveById.mockResolvedValue({ id: 'list-1' } as any);
      labelRepo.findById.mockResolvedValue({
        id: 'lbl-1',
        workspaceId: 'other-ws',
        boardId: 'other-board',
      } as any);

      await expect(
        service.create(
          'board-uuid',
          'ws-uuid',
          'list-1',
          { title: 'Task', labelIds: ['lbl-1'] },
          'user-uuid',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getCardDetails', () => {
    it('should retrieve card details with relations', async () => {
      const mockCard = { id: 'c-1', title: 'Task' };
      cardRepo.findActiveById.mockResolvedValue(mockCard as any);

      const result = await service.getCardDetails(
        'board-uuid',
        'ws-uuid',
        'c-1',
      );
      expect(result).toEqual(mockCard);
    });

    it('should throw EntityNotFoundException if card not found', async () => {
      cardRepo.findActiveById.mockResolvedValue(null);

      await expect(
        service.getCardDetails('board-uuid', 'ws-uuid', 'c-99'),
      ).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe('update', () => {
    it('should update card fields and emit card.updated event', async () => {
      cardRepo.findActiveById.mockResolvedValue({ id: 'c-1' } as any);
      const updatedCard = { id: 'c-1', title: 'Updated Title' };
      cardRepo.update.mockResolvedValue(updatedCard as any);

      const result = await service.update(
        'board-uuid',
        'ws-uuid',
        'c-1',
        {
          title: 'Updated Title',
          description: 'New Desc',
          dueDate: new Date().toISOString(),
          isComplete: true,
          coverImageUrl: 'https://example.com/cover.png',
        },
        'user-uuid',
      );

      expect(result).toEqual(updatedCard);
      expect(cardRepo.update).toHaveBeenCalledWith(
        'c-1',
        expect.objectContaining({
          title: 'Updated Title',
          isComplete: true,
        }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'card.updated',
        expect.any(Object),
      );
    });

    it('should throw EntityNotFoundException if card not found during update', async () => {
      cardRepo.findActiveById.mockResolvedValue(null);

      await expect(
        service.update(
          'board-uuid',
          'ws-uuid',
          'c-99',
          { title: 'New' },
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

    it('should fall back to initial rank if rank calculation throws during move', async () => {
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
        rank: lexorankService.getInitialRank(),
      } as any);

      await service.move(
        'board-uuid',
        'ws-uuid',
        'card-uuid',
        {
          targetListId: 'list-2',
          prevRank: 'corrupted-rank-prev',
          nextRank: 'corrupted-rank-next',
        },
        'user-uuid',
      );

      expect(cardRepo.moveCard).toHaveBeenCalledWith(
        'card-uuid',
        'list-2',
        lexorankService.getInitialRank(),
      );
    });

    it('should throw EntityNotFoundException if card not found during move', async () => {
      cardRepo.findActiveById.mockResolvedValue(null);

      await expect(
        service.move(
          'board-uuid',
          'ws-uuid',
          'c-99',
          { targetListId: 'list-2' },
          'user-uuid',
        ),
      ).rejects.toThrow(EntityNotFoundException);
    });

    it('should throw BadRequestException if target list does not belong to board', async () => {
      cardRepo.findActiveById.mockResolvedValue({
        id: 'c-1',
        listId: 'list-1',
      } as any);
      listRepo.findActiveById.mockResolvedValue(null);

      await expect(
        service.move(
          'board-uuid',
          'ws-uuid',
          'c-1',
          { targetListId: 'list-other' },
          'user-uuid',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('archive and unarchive', () => {
    it('should archive card and emit card.archived', async () => {
      cardRepo.findActiveById.mockResolvedValue({
        id: 'c-1',
        listId: 'l-1',
      } as any);
      cardRepo.archive.mockResolvedValue({ id: 'c-1' } as any);

      await service.archive('board-uuid', 'ws-uuid', 'c-1', 'user-uuid');

      expect(cardRepo.archive).toHaveBeenCalledWith('c-1');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'card.archived',
        expect.any(Object),
      );
    });

    it('should throw EntityNotFoundException if card not found during archive', async () => {
      cardRepo.findActiveById.mockResolvedValue(null);

      await expect(
        service.archive('board-uuid', 'ws-uuid', 'c-99', 'user-uuid'),
      ).rejects.toThrow(EntityNotFoundException);
    });

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

    it('should throw EntityNotFoundException when unarchiving nonexistent card', async () => {
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

  describe('Assignees', () => {
    it('should add assignee to card and emit card.assignee_added', async () => {
      cardRepo.findActiveById.mockResolvedValue({ id: 'c-1' } as any);
      workspaceService.isUserMember.mockResolvedValue(true);
      cardRepo.addAssignee.mockResolvedValue();

      await service.addAssignee(
        'board-uuid',
        'ws-uuid',
        'c-1',
        'u-2',
        'actor-1',
      );

      expect(cardRepo.addAssignee).toHaveBeenCalledWith('c-1', 'u-2');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        CARD_EVENTS.assigneeAdded,
        expect.anything(),
      );
    });

    it('should throw BadRequestException if user is not member when adding assignee', async () => {
      cardRepo.findActiveById.mockResolvedValue({ id: 'c-1' } as any);
      workspaceService.isUserMember.mockResolvedValue(false);

      await expect(
        service.addAssignee(
          'board-uuid',
          'ws-uuid',
          'c-1',
          'u-stranger',
          'actor-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw EntityNotFoundException if card not found when adding assignee', async () => {
      cardRepo.findActiveById.mockResolvedValue(null);

      await expect(
        service.addAssignee('board-uuid', 'ws-uuid', 'c-99', 'u-2', 'actor-1'),
      ).rejects.toThrow(EntityNotFoundException);
    });

    it('should remove assignee from card and emit card.assignee_removed', async () => {
      cardRepo.findActiveById.mockResolvedValue({ id: 'c-1' } as any);
      cardRepo.removeAssignee.mockResolvedValue();

      await service.removeAssignee(
        'board-uuid',
        'ws-uuid',
        'c-1',
        'u-2',
        'actor-1',
      );

      expect(cardRepo.removeAssignee).toHaveBeenCalledWith('c-1', 'u-2');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        CARD_EVENTS.assigneeRemoved,
        expect.anything(),
      );
    });

    it('should throw EntityNotFoundException if card not found when removing assignee', async () => {
      cardRepo.findActiveById.mockResolvedValue(null);

      await expect(
        service.removeAssignee(
          'board-uuid',
          'ws-uuid',
          'c-99',
          'u-2',
          'actor-1',
        ),
      ).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe('Labels', () => {
    it('should add workspace-level label to card', async () => {
      cardRepo.findActiveById.mockResolvedValue({ id: 'card-uuid' } as any);
      labelRepo.findById.mockResolvedValue({
        id: 'label-1',
        workspaceId: 'ws-uuid',
        boardId: null,
      } as any);
      cardRepo.addLabel.mockResolvedValue();

      await service.addLabel('board-uuid', 'ws-uuid', 'card-uuid', 'label-1');

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

      await service.addLabel('board-uuid', 'ws-uuid', 'card-uuid', 'label-2');

      expect(cardRepo.addLabel).toHaveBeenCalledWith('card-uuid', 'label-2');
    });

    it('should throw BadRequestException if label is invalid when adding to card', async () => {
      cardRepo.findActiveById.mockResolvedValue({ id: 'card-uuid' } as any);
      labelRepo.findById.mockResolvedValue(null);

      await expect(
        service.addLabel('board-uuid', 'ws-uuid', 'card-uuid', 'lbl-invalid'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw EntityNotFoundException if card not found when adding label', async () => {
      cardRepo.findActiveById.mockResolvedValue(null);

      await expect(
        service.addLabel('board-uuid', 'ws-uuid', 'c-99', 'lbl-1'),
      ).rejects.toThrow(EntityNotFoundException);
    });

    it('should remove label from card', async () => {
      cardRepo.findActiveById.mockResolvedValue({ id: 'card-uuid' } as any);
      cardRepo.removeLabel.mockResolvedValue();

      await service.removeLabel('board-uuid', 'ws-uuid', 'card-uuid', 'lbl-1');

      expect(cardRepo.removeLabel).toHaveBeenCalledWith('card-uuid', 'lbl-1');
    });

    it('should throw EntityNotFoundException if card not found when removing label', async () => {
      cardRepo.findActiveById.mockResolvedValue(null);

      await expect(
        service.removeLabel('board-uuid', 'ws-uuid', 'c-99', 'lbl-1'),
      ).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe('updatePriority', () => {
    it('should change priority and emit event', async () => {
      cardRepo.findActiveById.mockResolvedValue({
        id: 'c-1',
        priority: 'low',
      } as any);
      cardRepo.updatePriority.mockResolvedValue({
        id: 'c-1',
        priority: 'high',
      } as any);

      const result = await service.updatePriority(
        'board-uuid',
        'ws-uuid',
        'c-1',
        { priority: 'high' } as any,
        'user-1',
      );

      expect(result.priority).toBe('high');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        CARD_EVENTS.priorityChanged,
        expect.anything(),
      );
    });

    it('should return existing card when priority unchanged', async () => {
      const existing = { id: 'c-1', priority: 'high' } as any;
      cardRepo.findActiveById.mockResolvedValue(existing);

      await expect(
        service.updatePriority(
          'board-uuid',
          'ws-uuid',
          'c-1',
          { priority: 'high' } as any,
          'user-1',
        ),
      ).resolves.toBe(existing);
      expect(cardRepo.updatePriority).not.toHaveBeenCalled();
    });

    it('should throw when card not found', async () => {
      cardRepo.findActiveById.mockResolvedValue(null);

      await expect(
        service.updatePriority(
          'board-uuid',
          'ws-uuid',
          'c-x',
          { priority: 'high' } as any,
          'user-1',
        ),
      ).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('should change status and derive isComplete', async () => {
      cardRepo.findActiveById.mockResolvedValue({
        id: 'c-1',
        status: 'active',
      } as any);
      cardRepo.updateStatus.mockResolvedValue({
        id: 'c-1',
        status: 'done',
      } as any);

      const result = await service.updateStatus(
        'board-uuid',
        'ws-uuid',
        'c-1',
        { status: 'done' } as any,
        'user-1',
      );

      expect(cardRepo.updateStatus).toHaveBeenCalledWith('c-1', 'done', true);
      expect(result.status).toBe('done');
    });

    it('should return existing card on same-status no-op', async () => {
      const existing = { id: 'c-1', status: 'active' } as any;
      cardRepo.findActiveById.mockResolvedValue(existing);

      await expect(
        service.updateStatus(
          'board-uuid',
          'ws-uuid',
          'c-1',
          { status: 'active' } as any,
          'user-1',
        ),
      ).resolves.toBe(existing);
      expect(cardRepo.updateStatus).not.toHaveBeenCalled();
    });

    it('should throw when card not found', async () => {
      cardRepo.findActiveById.mockResolvedValue(null);

      await expect(
        service.updateStatus(
          'board-uuid',
          'ws-uuid',
          'c-x',
          { status: 'done' } as any,
          'user-1',
        ),
      ).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe('createSubcard', () => {
    it('should create subcard under depth-1 parent', async () => {
      cardRepo.findActiveById.mockResolvedValue({
        id: 'p-1',
        listId: 'l-1',
        parentCardId: null,
      } as any);
      cardRepo.findLastInList.mockResolvedValue(null);
      cardRepo.create.mockResolvedValue({ id: 'c-sub' } as any);

      const result = await service.createSubcard(
        'board-uuid',
        'ws-uuid',
        'p-1',
        { title: 'Sub' },
        'user-1',
      );

      expect(cardRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ parentCardId: 'p-1', listId: 'l-1' }),
        undefined,
        undefined,
      );
      expect(result).toEqual({ id: 'c-sub' });
    });

    it('should throw when parent not found', async () => {
      cardRepo.findActiveById.mockResolvedValue(null);

      await expect(
        service.createSubcard(
          'board-uuid',
          'ws-uuid',
          'p-x',
          { title: 'Sub' } as any,
          'user-1',
        ),
      ).rejects.toThrow(EntityNotFoundException);
    });

    it('should throw MAX_DEPTH when parent is itself a subcard', async () => {
      cardRepo.findActiveById.mockResolvedValue({
        id: 'p-1',
        listId: 'l-1',
        parentCardId: 'gp-1',
      } as any);

      await expect(
        service.createSubcard(
          'board-uuid',
          'ws-uuid',
          'p-1',
          { title: 'Sub' } as any,
          'user-1',
        ),
      ).rejects.toThrow('Cannot create subcard under a subcard');
    });
  });

  describe('attachSubcard', () => {
    it('should attach child to parent', async () => {
      cardRepo.findActiveById
        .mockResolvedValueOnce({
          id: 'p-1',
          parentCardId: null,
        } as any)
        .mockResolvedValueOnce({ id: 'c-1', parentCardId: null } as any);
      cardRepo.countSubcards.mockResolvedValue(0);
      cardRepo.attachSubcard.mockResolvedValue({ id: 'c-1' } as any);

      const result = await service.attachSubcard(
        'board-uuid',
        'ws-uuid',
        'p-1',
        'c-1',
        'user-1',
      );

      expect(result).toEqual({ id: 'c-1' });
    });

    it('should throw when parent not found', async () => {
      cardRepo.findActiveById.mockResolvedValue(null);

      await expect(
        service.attachSubcard('board-uuid', 'ws-uuid', 'p-x', 'c-1', 'user-1'),
      ).rejects.toThrow(EntityNotFoundException);
    });

    it('should throw MAX_DEPTH when parent is a subcard', async () => {
      cardRepo.findActiveById.mockResolvedValue({
        id: 'p-1',
        parentCardId: 'gp-1',
      } as any);

      await expect(
        service.attachSubcard('board-uuid', 'ws-uuid', 'p-1', 'c-1', 'user-1'),
      ).rejects.toThrow('Cannot attach subcard under a subcard');
    });

    it('should throw when child not found', async () => {
      cardRepo.findActiveById
        .mockResolvedValueOnce({ id: 'p-1', parentCardId: null } as any)
        .mockResolvedValueOnce(null);

      await expect(
        service.attachSubcard('board-uuid', 'ws-uuid', 'p-1', 'c-x', 'user-1'),
      ).rejects.toThrow(EntityNotFoundException);
    });

    it('should throw CYCLE when attaching card to itself', async () => {
      const self = { id: 'p-1', parentCardId: null } as any;
      cardRepo.findActiveById
        .mockResolvedValueOnce(self)
        .mockResolvedValueOnce(self);

      await expect(
        service.attachSubcard('board-uuid', 'ws-uuid', 'p-1', 'p-1', 'user-1'),
      ).rejects.toThrow('A card cannot be its own parent');
    });

    it('should throw when child already has a parent', async () => {
      cardRepo.findActiveById
        .mockResolvedValueOnce({ id: 'p-1', parentCardId: null } as any)
        .mockResolvedValueOnce({ id: 'c-1', parentCardId: 'other' } as any);

      await expect(
        service.attachSubcard('board-uuid', 'ws-uuid', 'p-1', 'c-1', 'user-1'),
      ).rejects.toThrow('Card already has a parent');
    });

    it('should throw when child has its own subcards', async () => {
      cardRepo.findActiveById
        .mockResolvedValueOnce({ id: 'p-1', parentCardId: null } as any)
        .mockResolvedValueOnce({ id: 'c-1', parentCardId: null } as any);
      cardRepo.countSubcards.mockResolvedValue(2);

      await expect(
        service.attachSubcard('board-uuid', 'ws-uuid', 'p-1', 'c-1', 'user-1'),
      ).rejects.toThrow('A card with subcards cannot become a subcard');
    });
  });

  describe('detachSubcard', () => {
    it('should detach subcard', async () => {
      cardRepo.findActiveById.mockResolvedValue({
        id: 'c-1',
        parentCardId: 'p-1',
      } as any);
      cardRepo.detachSubcard.mockResolvedValue({ id: 'c-1' } as any);

      await expect(
        service.detachSubcard('board-uuid', 'ws-uuid', 'c-1', 'user-1'),
      ).resolves.toEqual({ id: 'c-1' });
    });

    it('should throw when card not found', async () => {
      cardRepo.findActiveById.mockResolvedValue(null);

      await expect(
        service.detachSubcard('board-uuid', 'ws-uuid', 'c-x', 'user-1'),
      ).rejects.toThrow(EntityNotFoundException);
    });

    it('should throw NO_PARENT when card is top-level', async () => {
      cardRepo.findActiveById.mockResolvedValue({
        id: 'c-1',
        parentCardId: null,
      } as any);

      await expect(
        service.detachSubcard('board-uuid', 'ws-uuid', 'c-1', 'user-1'),
      ).rejects.toThrow('Card is not a subcard');
    });
  });

  describe('getWithSubcards', () => {
    it('should return parent with rollup', async () => {
      cardRepo.findActiveById.mockResolvedValue({
        id: 'p-1',
        status: 'active',
      } as any);
      cardRepo.findSubcards.mockResolvedValue([
        { id: 'c-1', status: 'done', estimateMinutes: 60, loggedMinutes: 30 },
        {
          id: 'c-2',
          status: 'active',
          estimateMinutes: null,
          loggedMinutes: 5,
        },
      ] as any);

      const result = await service.getWithSubcards(
        'board-uuid',
        'ws-uuid',
        'p-1',
      );

      expect(result.subcardRollup).toEqual({
        total: 2,
        done: 1,
        estimateSum: 60,
        loggedSum: 35,
      });
    });

    it('should throw when parent not found', async () => {
      cardRepo.findActiveById.mockResolvedValue(null);

      await expect(
        service.getWithSubcards('board-uuid', 'ws-uuid', 'p-x'),
      ).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe('create with parentCardId', () => {
    it('should create card linked to depth-1 parent', async () => {
      listRepo.findActiveById.mockResolvedValue({ id: 'list-1' } as any);
      cardRepo.findActiveById.mockResolvedValue({
        id: 'p-1',
        parentCardId: null,
      } as any);
      cardRepo.findLastInList.mockResolvedValue(null);
      cardRepo.create.mockResolvedValue({ id: 'c-sub' } as any);

      const result = await service.create(
        'board-uuid',
        'ws-uuid',
        'list-1',
        { title: 'Sub', parentCardId: 'p-1' },
        'user-uuid',
      );

      expect(result).toEqual({ id: 'c-sub' });
      expect(cardRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ parentCardId: 'p-1' }),
        undefined,
        undefined,
      );
    });

    it('should throw when parent card not found', async () => {
      listRepo.findActiveById.mockResolvedValue({ id: 'list-1' } as any);
      cardRepo.findActiveById.mockResolvedValue(null);

      await expect(
        service.create(
          'board-uuid',
          'ws-uuid',
          'list-1',
          { title: 'Sub', parentCardId: 'p-x' } as any,
          'user-uuid',
        ),
      ).rejects.toThrow(EntityNotFoundException);
    });

    it('should throw MAX_DEPTH when parent is a subcard', async () => {
      listRepo.findActiveById.mockResolvedValue({ id: 'list-1' } as any);
      cardRepo.findActiveById.mockResolvedValue({
        id: 'p-1',
        parentCardId: 'gp-1',
      } as any);

      await expect(
        service.create(
          'board-uuid',
          'ws-uuid',
          'list-1',
          { title: 'Sub', parentCardId: 'p-1' } as any,
          'user-uuid',
        ),
      ).rejects.toThrow('Cannot create subcard under a subcard');
    });
  });

  describe('update status/isComplete derivation', () => {
    it('should derive isComplete from explicit status', async () => {
      cardRepo.findActiveById.mockResolvedValue({
        id: 'c-1',
        status: 'active',
      } as any);
      cardRepo.update.mockResolvedValue({ id: 'c-1' } as any);

      await service.update(
        'board-uuid',
        'ws-uuid',
        'c-1',
        { status: 'closed' } as any,
        'user-uuid',
      );

      expect(cardRepo.update).toHaveBeenCalledWith(
        'c-1',
        expect.objectContaining({ status: 'closed', isComplete: true }),
      );
    });

    it('should map isComplete false to active status', async () => {
      cardRepo.findActiveById.mockResolvedValue({
        id: 'c-1',
        status: 'done',
      } as any);
      cardRepo.update.mockResolvedValue({ id: 'c-1' } as any);

      await service.update(
        'board-uuid',
        'ws-uuid',
        'c-1',
        { isComplete: false },
        'user-uuid',
      );

      expect(cardRepo.update).toHaveBeenCalledWith(
        'c-1',
        expect.objectContaining({ status: 'active', isComplete: false }),
      );
    });

    it('should keep existing status when isComplete already matches', async () => {
      cardRepo.findActiveById.mockResolvedValue({
        id: 'c-1',
        status: 'closed',
      } as any);
      cardRepo.update.mockResolvedValue({ id: 'c-1' } as any);

      await service.update(
        'board-uuid',
        'ws-uuid',
        'c-1',
        { isComplete: true },
        'user-uuid',
      );

      expect(cardRepo.update).toHaveBeenCalledWith(
        'c-1',
        expect.objectContaining({ status: 'closed', isComplete: true }),
      );
    });

    it('should persist estimateMinutes', async () => {
      cardRepo.findActiveById.mockResolvedValue({
        id: 'c-1',
        status: 'active',
      } as any);
      cardRepo.update.mockResolvedValue({ id: 'c-1' } as any);

      await service.update(
        'board-uuid',
        'ws-uuid',
        'c-1',
        { estimateMinutes: 120 },
        'user-uuid',
      );

      expect(cardRepo.update).toHaveBeenCalledWith(
        'c-1',
        expect.objectContaining({ estimateMinutes: 120 }),
      );
    });

    it('should clear dueDate when null is provided', async () => {
      cardRepo.findActiveById.mockResolvedValue({
        id: 'c-1',
        status: 'active',
      } as any);
      cardRepo.update.mockResolvedValue({ id: 'c-1' } as any);

      await service.update(
        'board-uuid',
        'ws-uuid',
        'c-1',
        { dueDate: null } as any,
        'user-uuid',
      );

      expect(cardRepo.update).toHaveBeenCalledWith(
        'c-1',
        expect.objectContaining({ dueDate: null }),
      );
    });

    it('should persist explicit priority', async () => {
      cardRepo.findActiveById.mockResolvedValue({
        id: 'c-1',
        status: 'active',
      } as any);
      cardRepo.update.mockResolvedValue({ id: 'c-1' } as any);

      await service.update(
        'board-uuid',
        'ws-uuid',
        'c-1',
        { priority: 'urgent' } as any,
        'user-uuid',
      );

      expect(cardRepo.update).toHaveBeenCalledWith(
        'c-1',
        expect.objectContaining({ priority: 'urgent' }),
      );
    });
  });

  describe('createSubcard with dueDate', () => {
    it('should pass dueDate through to creation', async () => {
      cardRepo.findActiveById.mockResolvedValue({
        id: 'p-1',
        listId: 'l-1',
        parentCardId: null,
      } as any);
      cardRepo.findLastInList.mockResolvedValue(null);
      cardRepo.create.mockResolvedValue({ id: 'c-sub' } as any);

      await service.createSubcard(
        'board-uuid',
        'ws-uuid',
        'p-1',
        { title: 'Sub', dueDate: '2026-12-31T00:00:00.000Z' },
        'user-uuid',
      );

      expect(cardRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          dueDate: new Date('2026-12-31T00:00:00.000Z'),
        }),
        undefined,
        undefined,
      );
    });
  });

  describe('createSubcard rank fallback', () => {
    it('should fall back to initial rank when rank calculation throws', async () => {
      cardRepo.findActiveById.mockResolvedValue({
        id: 'p-1',
        listId: 'l-1',
        parentCardId: null,
      } as any);
      cardRepo.findLastInList.mockResolvedValue({
        id: 'c-0',
        rank: 'corrupt',
      } as any);
      jest
        .spyOn(lexorankService, 'getRankBetween')
        .mockImplementationOnce(() => {
          throw new Error('bad rank');
        });
      cardRepo.create.mockResolvedValue({ id: 'c-sub' } as any);

      await expect(
        service.createSubcard(
          'board-uuid',
          'ws-uuid',
          'p-1',
          { title: 'Sub' } as any,
          'user-uuid',
        ),
      ).resolves.toEqual({ id: 'c-sub' });
    });
  });

  describe('listArchivedCardsPaginated', () => {
    it('should return archived page', async () => {
      cardRepo.findArchivedByBoardIdPage.mockResolvedValue({
        items: [{ id: 'c-1' }],
        pagination: { cursor: null, hasMore: false },
      } as any);

      const result = await service.listArchivedCardsPaginated(
        'board-uuid',
        'ws-uuid',
        {},
      );

      expect(result.items).toHaveLength(1);
    });

    it('should throw when board not found', async () => {
      boardRepo.findById.mockResolvedValueOnce(null);

      await expect(
        service.listArchivedCardsPaginated('b-x', 'ws-uuid', {}),
      ).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe('deletePermanently', () => {
    it('should permanently delete card', async () => {
      cardRepo.findByIdIncludingDeleted.mockResolvedValue({
        id: 'c-1',
        listId: 'l-1',
        deletedAt: null,
      } as any);

      await service.deletePermanently('board-uuid', 'ws-uuid', 'c-1', 'user-1');

      expect(cardRepo.deletePermanently).toHaveBeenCalledWith('c-1');
    });

    it('should throw when card not found', async () => {
      cardRepo.findByIdIncludingDeleted.mockResolvedValue(null);

      await expect(
        service.deletePermanently('board-uuid', 'ws-uuid', 'c-x', 'user-1'),
      ).rejects.toThrow(EntityNotFoundException);
    });

    it('should throw when already deleted', async () => {
      cardRepo.findByIdIncludingDeleted.mockResolvedValue({
        id: 'c-1',
        listId: 'l-1',
        deletedAt: new Date(),
      } as any);

      await expect(
        service.deletePermanently('board-uuid', 'ws-uuid', 'c-1', 'user-1'),
      ).rejects.toThrow('Card is already deleted');
    });
  });
});
