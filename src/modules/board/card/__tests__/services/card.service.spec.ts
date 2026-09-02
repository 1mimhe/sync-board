import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { CardService } from '../../services/card.service';
import { CardRepository } from '../../repositories/card.repository';
import { BoardRepository } from '../../../board/repositories/board.repository';
import { ListRepository } from '../../../list/repositories/list.repository';
import { LabelRepository } from '../../../label/repositories/label.repository';
import { WorkspaceService } from '../../../../workspace/services/workspace.service';
import { LexorankService } from '../../../lexorank/services/lexorank.service';
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

  describe('listArchivedCards', () => {
    it('should return archived cards for board when board exists', async () => {
      boardRepo.findById.mockResolvedValue({ id: 'board-uuid' } as any);
      cardRepo.findArchivedByBoardId.mockResolvedValue([
        { id: 'c-archived', title: 'Archived Card' },
      ] as any);

      const result = await service.listArchivedCards('board-uuid', 'ws-uuid');

      expect(cardRepo.findArchivedByBoardId).toHaveBeenCalledWith('board-uuid');
      expect(result).toHaveLength(1);
    });

    it('should throw EntityNotFoundException if board not found', async () => {
      boardRepo.findById.mockResolvedValue(null);

      await expect(
        service.listArchivedCards('b-nonexistent', 'ws-uuid'),
      ).rejects.toThrow(EntityNotFoundException);
    });

    it('should list all archived cards across a workspace', async () => {
      cardRepo.findArchivedByWorkspaceId.mockResolvedValue([
        { id: 'c-archived-1' },
        { id: 'c-archived-2' },
      ] as any);

      const result = await service.listWorkspaceArchivedCards('ws-uuid');

      expect(cardRepo.findArchivedByWorkspaceId).toHaveBeenCalledWith('ws-uuid');
      expect(result).toHaveLength(2);
    });
  });
});
