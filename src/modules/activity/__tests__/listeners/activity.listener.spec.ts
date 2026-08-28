import { Test, TestingModule } from '@nestjs/testing';
import { ActivityListener } from '../../listeners/activity.listener';
import { ActivityRepository } from '../../repositories/activity.repository';
import {
  BoardCreatedEvent,
  BoardUpdatedEvent,
  BoardArchivedEvent,
  BoardUnarchivedEvent,
} from '../../../board/board/events/board.events';
import {
  ListCreatedEvent,
  ListUpdatedEvent,
  ListMovedEvent,
  ListArchivedEvent,
  ListUnarchivedEvent,
} from '../../../board/list/events/list.events';
import {
  CardCreatedEvent,
  CardMovedEvent,
  CardUpdatedEvent,
  CardArchivedEvent,
  CardUnarchivedEvent,
} from '../../../board/card/events/card.events';
import { CommentCreatedEvent } from '../../../board/comment/events/comment.events';
import {
  CommentUpdatedEvent,
  CommentDeletedEvent,
} from '../../../board/comment/events/comment.events';
import {
  LabelCreatedEvent,
  LabelUpdatedEvent,
  LabelDeletedEvent,
} from '../../../board/label/events/label.events';
import {
  CardAssigneeAddedEvent,
  CardAssigneeRemovedEvent,
} from '../../../board/card/events/card.events';
import { ActionType, EntityType } from '@prisma/client';

describe('ActivityListener', () => {
  let listener: ActivityListener;
  let activityRepo: jest.Mocked<ActivityRepository>;

  beforeEach(async () => {
    activityRepo = {
      create: jest.fn().mockResolvedValue({ id: 'act-1' } as any),
      findByBoardId: jest.fn(),
    } as unknown as jest.Mocked<ActivityRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityListener,
        { provide: ActivityRepository, useValue: activityRepo },
      ],
    }).compile();

    listener = module.get<ActivityListener>(ActivityListener);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Board Events', () => {
    it('should log board created event', async () => {
      const event = new BoardCreatedEvent(
        { id: 'b-1', title: 'Board' } as any,
        'u-1',
      );
      await listener.handleBoardCreatedEvent(event);
      expect(activityRepo.create).toHaveBeenCalledWith({
        boardId: 'b-1',
        userId: 'u-1',
        action: ActionType.created,
        entityType: EntityType.board,
        entityId: 'b-1',
        entityTitle: 'Board',
      });
    });

    it('should catch error on board created event failure', async () => {
      activityRepo.create.mockRejectedValue(new Error('fail'));
      await expect(
        listener.handleBoardCreatedEvent(
          new BoardCreatedEvent({ id: 'b-1' } as any, 'u-1'),
        ),
      ).resolves.not.toThrow();
    });

    it('should log board updated event', async () => {
      const event = new BoardUpdatedEvent(
        { id: 'b-1', title: 'Updated Board' } as any,
        'u-1',
      );
      await listener.handleBoardUpdatedEvent(event);
      expect(activityRepo.create).toHaveBeenCalledWith({
        boardId: 'b-1',
        userId: 'u-1',
        action: ActionType.updated,
        entityType: EntityType.board,
        entityId: 'b-1',
        entityTitle: 'Updated Board',
      });
    });

    it('should catch error on board updated event failure', async () => {
      activityRepo.create.mockRejectedValue(new Error('fail'));
      await expect(
        listener.handleBoardUpdatedEvent(
          new BoardUpdatedEvent({ id: 'b-1' } as any, 'u-1'),
        ),
      ).resolves.not.toThrow();
    });

    it('should log board archived event', async () => {
      const event = new BoardArchivedEvent('b-1', 'ws-1', 'u-1');
      await listener.handleBoardArchivedEvent(event);
      expect(activityRepo.create).toHaveBeenCalledWith({
        boardId: 'b-1',
        userId: 'u-1',
        action: ActionType.archived,
        entityType: EntityType.board,
        entityId: 'b-1',
      });
    });

    it('should catch error on board archived event failure', async () => {
      activityRepo.create.mockRejectedValue(new Error('fail'));
      await expect(
        listener.handleBoardArchivedEvent(
          new BoardArchivedEvent('b-1', 'ws-1', 'u-1'),
        ),
      ).resolves.not.toThrow();
    });

    it('should log board unarchived event', async () => {
      const event = new BoardUnarchivedEvent(
        { id: 'b-1', title: 'Restored Board' } as any,
        'u-1',
      );
      await listener.handleBoardUnarchivedEvent(event);
      expect(activityRepo.create).toHaveBeenCalledWith({
        boardId: 'b-1',
        userId: 'u-1',
        action: ActionType.unarchived,
        entityType: EntityType.board,
        entityId: 'b-1',
        entityTitle: 'Restored Board',
      });
    });

    it('should catch error on board unarchived event failure', async () => {
      activityRepo.create.mockRejectedValue(new Error('fail'));
      await expect(
        listener.handleBoardUnarchivedEvent(
          new BoardUnarchivedEvent({ id: 'b-1' } as any, 'u-1'),
        ),
      ).resolves.not.toThrow();
    });
  });

  describe('List Events', () => {
    it('should log list created event', async () => {
      const event = new ListCreatedEvent(
        { id: 'l-1', boardId: 'b-1', title: 'To Do' } as any,
        'u-1',
      );
      await listener.handleListCreatedEvent(event);
      expect(activityRepo.create).toHaveBeenCalledWith({
        boardId: 'b-1',
        userId: 'u-1',
        action: ActionType.created,
        entityType: EntityType.list,
        entityId: 'l-1',
        entityTitle: 'To Do',
      });
    });

    it('should catch error on list created event failure', async () => {
      activityRepo.create.mockRejectedValue(new Error('fail'));
      await expect(
        listener.handleListCreatedEvent(
          new ListCreatedEvent({ id: 'l-1' } as any, 'u-1'),
        ),
      ).resolves.not.toThrow();
    });

    it('should log list updated event', async () => {
      const event = new ListUpdatedEvent(
        { id: 'l-1', boardId: 'b-1', title: 'Doing' } as any,
        'u-1',
      );
      await listener.handleListUpdatedEvent(event);
      expect(activityRepo.create).toHaveBeenCalledWith({
        boardId: 'b-1',
        userId: 'u-1',
        action: ActionType.updated,
        entityType: EntityType.list,
        entityId: 'l-1',
        entityTitle: 'Doing',
      });
    });

    it('should catch error on list updated event failure', async () => {
      activityRepo.create.mockRejectedValue(new Error('fail'));
      await expect(
        listener.handleListUpdatedEvent(
          new ListUpdatedEvent({ id: 'l-1' } as any, 'u-1'),
        ),
      ).resolves.not.toThrow();
    });

    it('should log list moved event', async () => {
      const event = new ListMovedEvent('l-1', 'b-1', '0|b:', 'u-1');
      await listener.handleListMovedEvent(event);
      expect(activityRepo.create).toHaveBeenCalledWith({
        boardId: 'b-1',
        userId: 'u-1',
        action: ActionType.moved,
        entityType: EntityType.list,
        entityId: 'l-1',
      });
    });

    it('should catch error on list moved event failure', async () => {
      activityRepo.create.mockRejectedValue(new Error('fail'));
      await expect(
        listener.handleListMovedEvent(
          new ListMovedEvent('l-1', 'b-1', '0|b:', 'u-1'),
        ),
      ).resolves.not.toThrow();
    });

    it('should log list archived event', async () => {
      const event = new ListArchivedEvent('l-1', 'b-1', 'u-1');
      await listener.handleListArchivedEvent(event);
      expect(activityRepo.create).toHaveBeenCalledWith({
        boardId: 'b-1',
        userId: 'u-1',
        action: ActionType.archived,
        entityType: EntityType.list,
        entityId: 'l-1',
      });
    });

    it('should catch error on list archived event failure', async () => {
      activityRepo.create.mockRejectedValue(new Error('fail'));
      await expect(
        listener.handleListArchivedEvent(
          new ListArchivedEvent('l-1', 'b-1', 'u-1'),
        ),
      ).resolves.not.toThrow();
    });

    it('should log list unarchived event', async () => {
      const event = new ListUnarchivedEvent(
        { id: 'l-1', boardId: 'b-1', title: 'Restored List' } as any,
        'u-1',
      );
      await listener.handleListUnarchivedEvent(event);
      expect(activityRepo.create).toHaveBeenCalledWith({
        boardId: 'b-1',
        userId: 'u-1',
        action: ActionType.unarchived,
        entityType: EntityType.list,
        entityId: 'l-1',
        entityTitle: 'Restored List',
      });
    });

    it('should catch error on list unarchived event failure', async () => {
      activityRepo.create.mockRejectedValue(new Error('fail'));
      await expect(
        listener.handleListUnarchivedEvent(
          new ListUnarchivedEvent({ id: 'l-1' } as any, 'u-1'),
        ),
      ).resolves.not.toThrow();
    });
  });

  describe('Card Events', () => {
    it('should log card created event', async () => {
      const event = new CardCreatedEvent(
        { id: 'c-1', title: 'Card 1' } as any,
        'b-1',
        'l-1',
        'u-1',
      );
      await listener.handleCardCreatedEvent(event);
      expect(activityRepo.create).toHaveBeenCalledWith({
        boardId: 'b-1',
        userId: 'u-1',
        action: ActionType.created,
        entityType: EntityType.card,
        entityId: 'c-1',
        entityTitle: 'Card 1',
        toListId: 'l-1',
      });
    });

    it('should catch error on card created event failure', async () => {
      activityRepo.create.mockRejectedValue(new Error('fail'));
      await expect(
        listener.handleCardCreatedEvent(
          new CardCreatedEvent({ id: 'c-1' } as any, 'b-1', 'l-1', 'u-1'),
        ),
      ).resolves.not.toThrow();
    });

    it('should log card moved event', async () => {
      const event = new CardMovedEvent(
        'c-1',
        'b-1',
        'l-1',
        'l-2',
        '0|b:',
        'u-1',
      );
      await listener.handleCardMovedEvent(event);
      expect(activityRepo.create).toHaveBeenCalledWith({
        boardId: 'b-1',
        userId: 'u-1',
        action: ActionType.moved,
        entityType: EntityType.card,
        entityId: 'c-1',
        fromListId: 'l-1',
        toListId: 'l-2',
      });
    });

    it('should catch error on card moved event failure', async () => {
      activityRepo.create.mockRejectedValue(new Error('fail'));
      await expect(
        listener.handleCardMovedEvent(
          new CardMovedEvent('c-1', 'b-1', 'l-1', 'l-2', '0|b:', 'u-1'),
        ),
      ).resolves.not.toThrow();
    });

    it('should log card updated event', async () => {
      const event = new CardUpdatedEvent(
        { id: 'c-1', title: 'Updated Card' } as any,
        'b-1',
        'u-1',
      );
      await listener.handleCardUpdatedEvent(event);
      expect(activityRepo.create).toHaveBeenCalledWith({
        boardId: 'b-1',
        userId: 'u-1',
        action: ActionType.updated,
        entityType: EntityType.card,
        entityId: 'c-1',
        entityTitle: 'Updated Card',
      });
    });

    it('should catch error on card updated event failure', async () => {
      activityRepo.create.mockRejectedValue(new Error('fail'));
      await expect(
        listener.handleCardUpdatedEvent(
          new CardUpdatedEvent({ id: 'c-1' } as any, 'b-1', 'u-1'),
        ),
      ).resolves.not.toThrow();
    });

    it('should log card archived event', async () => {
      const event = new CardArchivedEvent('c-1', 'b-1', 'l-1', 'u-1');
      await listener.handleCardArchivedEvent(event);
      expect(activityRepo.create).toHaveBeenCalledWith({
        boardId: 'b-1',
        userId: 'u-1',
        action: ActionType.archived,
        entityType: EntityType.card,
        entityId: 'c-1',
        fromListId: 'l-1',
      });
    });

    it('should catch error on card archived event failure', async () => {
      activityRepo.create.mockRejectedValue(new Error('fail'));
      await expect(
        listener.handleCardArchivedEvent(
          new CardArchivedEvent('c-1', 'b-1', 'l-1', 'u-1'),
        ),
      ).resolves.not.toThrow();
    });

    it('should log card unarchived event', async () => {
      const event = new CardUnarchivedEvent(
        { id: 'c-1', title: 'Restored Card' } as any,
        'b-1',
        'l-1',
        'u-1',
      );
      await listener.handleCardUnarchivedEvent(event);
      expect(activityRepo.create).toHaveBeenCalledWith({
        boardId: 'b-1',
        userId: 'u-1',
        action: ActionType.unarchived,
        entityType: EntityType.card,
        entityId: 'c-1',
        entityTitle: 'Restored Card',
        fromListId: 'l-1',
      });
    });

    it('should catch error on card unarchived event failure', async () => {
      activityRepo.create.mockRejectedValue(new Error('fail'));
      await expect(
        listener.handleCardUnarchivedEvent(
          new CardUnarchivedEvent({ id: 'c-1' } as any, 'b-1', 'l-1', 'u-1'),
        ),
      ).resolves.not.toThrow();
    });
  });

  describe('Comment Events', () => {
    it('should log comment created event', async () => {
      const event = new CommentCreatedEvent(
        { id: 'comm-1' } as any,
        'b-1',
        'u-1',
      );
      await listener.handleCommentCreatedEvent(event);
      expect(activityRepo.create).toHaveBeenCalledWith({
        boardId: 'b-1',
        userId: 'u-1',
        action: ActionType.created,
        entityType: EntityType.comment,
        entityId: 'comm-1',
        entityTitle: 'New Comment',
      });
    });

    it('should catch error on comment created event failure', async () => {
      activityRepo.create.mockRejectedValue(new Error('fail'));
      await expect(
        listener.handleCommentCreatedEvent(
          new CommentCreatedEvent({ id: 'comm-1' } as any, 'b-1', 'u-1'),
        ),
      ).resolves.not.toThrow();
    });

    it('should log comment updated event and contain failures', async () => {
      const event = new CommentUpdatedEvent(
        { id: 'comm-1' } as any,
        'b-1',
        'u-2',
      );
      await listener.handleCommentUpdatedEvent(event);
      expect(activityRepo.create).toHaveBeenCalledWith({
        boardId: 'b-1',
        userId: 'u-2',
        action: ActionType.updated,
        entityType: EntityType.comment,
        entityId: 'comm-1',
        entityTitle: 'Comment Updated',
      });

      activityRepo.create.mockRejectedValue(new Error('fail'));
      await expect(
        listener.handleCommentUpdatedEvent(event),
      ).resolves.not.toThrow();
    });

    it('should log comment deleted event and contain failures', async () => {
      const event = new CommentDeletedEvent('comm-1', 'c-1', 'b-1', 'u-2');
      await listener.handleCommentDeletedEvent(event);
      expect(activityRepo.create).toHaveBeenCalledWith({
        boardId: 'b-1',
        userId: 'u-2',
        action: ActionType.deleted,
        entityType: EntityType.comment,
        entityId: 'comm-1',
      });

      activityRepo.create.mockRejectedValue(new Error('fail'));
      await expect(
        listener.handleCommentDeletedEvent(event),
      ).resolves.not.toThrow();
    });
  });

  describe('Label Events', () => {
    it('should log label created event for board-scoped labels', async () => {
      const event = new LabelCreatedEvent(
        { id: 'lbl-1', name: 'Bug' } as any,
        'ws-1',
        'b-1',
        'u-1',
      );
      await listener.handleLabelCreatedEvent(event);
      expect(activityRepo.create).toHaveBeenCalledWith({
        boardId: 'b-1',
        userId: 'u-1',
        action: ActionType.created,
        entityType: EntityType.label,
        entityId: 'lbl-1',
        entityTitle: 'Bug',
      });
    });

    it('should skip workspace-level label creation (no board scope)', async () => {
      const event = new LabelCreatedEvent(
        { id: 'lbl-ws' } as any,
        'ws-1',
        null,
        'u-1',
      );
      await listener.handleLabelCreatedEvent(event);
      expect(activityRepo.create).not.toHaveBeenCalled();
    });

    it('should contain label created event failures', async () => {
      activityRepo.create.mockRejectedValue(new Error('fail'));
      const event = new LabelCreatedEvent(
        { id: 'lbl-1', name: 'Bug' } as any,
        'ws-1',
        'b-1',
        'u-1',
      );
      await expect(
        listener.handleLabelCreatedEvent(event),
      ).resolves.not.toThrow();
    });

    it('should log label updated event and contain failures', async () => {
      const event = new LabelUpdatedEvent(
        { id: 'lbl-1', name: 'Hot' } as any,
        'b-1',
        'u-3',
      );
      await listener.handleLabelUpdatedEvent(event);
      expect(activityRepo.create).toHaveBeenCalledWith({
        boardId: 'b-1',
        userId: 'u-3',
        action: ActionType.updated,
        entityType: EntityType.label,
        entityId: 'lbl-1',
        entityTitle: 'Hot',
      });

      activityRepo.create.mockRejectedValue(new Error('fail'));
      await expect(
        listener.handleLabelUpdatedEvent(event),
      ).resolves.not.toThrow();
    });

    it('should log label deleted event and contain failures', async () => {
      const event = new LabelDeletedEvent('lbl-1', 'b-1', 'u-3');
      await listener.handleLabelDeletedEvent(event);
      expect(activityRepo.create).toHaveBeenCalledWith({
        boardId: 'b-1',
        userId: 'u-3',
        action: ActionType.deleted,
        entityType: EntityType.label,
        entityId: 'lbl-1',
      });

      activityRepo.create.mockRejectedValue(new Error('fail'));
      await expect(
        listener.handleLabelDeletedEvent(event),
      ).resolves.not.toThrow();
    });
  });

  describe('Card Assignee Events', () => {
    it('should log assignee added event and contain failures', async () => {
      const event = new CardAssigneeAddedEvent(
        'c-1',
        'b-1',
        'assignee-1',
        'u-1',
      );
      await listener.handleCardAssigneeAddedEvent(event);
      expect(activityRepo.create).toHaveBeenCalledWith({
        boardId: 'b-1',
        userId: 'u-1',
        action: ActionType.created,
        entityType: EntityType.assignee,
        entityId: 'c-1',
        entityTitle: 'assignee-1',
      });

      activityRepo.create.mockRejectedValue(new Error('fail'));
      await expect(
        listener.handleCardAssigneeAddedEvent(event),
      ).resolves.not.toThrow();
    });

    it('should log assignee removed event and contain failures', async () => {
      const event = new CardAssigneeRemovedEvent(
        'c-1',
        'b-1',
        'assignee-1',
        'u-1',
      );
      await listener.handleCardAssigneeRemovedEvent(event);
      expect(activityRepo.create).toHaveBeenCalledWith({
        boardId: 'b-1',
        userId: 'u-1',
        action: ActionType.deleted,
        entityType: EntityType.assignee,
        entityId: 'c-1',
        entityTitle: 'assignee-1',
      });

      activityRepo.create.mockRejectedValue(new Error('fail'));
      await expect(
        listener.handleCardAssigneeRemovedEvent(event),
      ).resolves.not.toThrow();
    });
  });
});
