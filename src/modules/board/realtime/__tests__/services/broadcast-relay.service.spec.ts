import { BroadcastRelayService } from '../../services/broadcast-relay.service';
import { WS_EVENTS } from '../../ws-events.constants';
import {
  BoardCreatedEvent,
  BoardUpdatedEvent,
  BoardArchivedEvent,
  BoardUnarchivedEvent,
} from '../../../board/events/board.events';
import {
  ListCreatedEvent,
  ListUpdatedEvent,
  ListMovedEvent,
  ListArchivedEvent,
  ListUnarchivedEvent,
} from '../../../list/events/list.events';
import {
  CardCreatedEvent,
  CardUpdatedEvent,
  CardMovedEvent,
  CardArchivedEvent,
  CardUnarchivedEvent,
} from '../../../card/events/card.events';
import { CommentCreatedEvent } from '../../../comment/events/comment.events';
import {
  CommentUpdatedEvent,
  CommentDeletedEvent,
} from '../../../comment/events/comment.events';
import {
  CardAssigneeAddedEvent,
  CardAssigneeRemovedEvent,
} from '../../../card/events/card.events';
import {
  AttachmentCreatedEvent,
  AttachmentDeletedEvent,
} from '../../../attachment/events/attachment.events';
import {
  ChecklistCreatedEvent,
  ChecklistUpdatedEvent,
  ChecklistDeletedEvent,
} from '../../../checklist/events/checklist.events';

describe('BroadcastRelayService', () => {
  let relay: BroadcastRelayService;
  let mockServer: any;

  beforeEach(() => {
    relay = new BroadcastRelayService();
    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };
    relay.attachServer(mockServer);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
  it('should broadcast board:created on BoardCreatedEvent', () => {
    const event = new BoardCreatedEvent(
      { id: 'b-1', workspaceId: 'ws-1', title: 'New Board' } as any,
      'user-1',
    );

    relay.broadcastBoardCreated(event);

    expect(mockServer.to).toHaveBeenCalledWith('workspace:ws-1');
    expect(mockServer.emit).toHaveBeenCalledWith(WS_EVENTS.BOARD_CREATED, {
      board: event.board,
      createdBy: { id: 'user-1' },
    });
  });

  it('should broadcast board:updated on BoardUpdatedEvent', () => {
    const event = new BoardUpdatedEvent(
      {
        id: '123e4567-e89b-42d3-a456-426614174000',
        title: 'New Title',
        description: 'Desc',
        backgroundColor: '#FFF',
        updatedAt: new Date(),
      } as any,
      'user-1',
    );

    relay.broadcastBoardUpdated(event);

    expect(mockServer.to).toHaveBeenCalledWith(
      'board:123e4567-e89b-42d3-a456-426614174000',
    );
    expect(mockServer.emit).toHaveBeenCalledWith(
      WS_EVENTS.BOARD_UPDATED,
      expect.objectContaining({
        boardId: '123e4567-e89b-42d3-a456-426614174000',
      }),
    );
  });

  it('should broadcast board:archived on BoardArchivedEvent', () => {
    const event = new BoardArchivedEvent(
      '123e4567-e89b-42d3-a456-426614174000',
      'ws-1',
      'user-1',
    );

    relay.broadcastBoardArchived(event);

    expect(mockServer.to).toHaveBeenCalledWith(
      'board:123e4567-e89b-42d3-a456-426614174000',
    );
    expect(mockServer.emit).toHaveBeenCalledWith(WS_EVENTS.BOARD_ARCHIVED, {
      boardId: '123e4567-e89b-42d3-a456-426614174000',
      archivedBy: { id: 'user-1' },
    });
  });

  it('should broadcast board:unarchived on BoardUnarchivedEvent', () => {
    const event = new BoardUnarchivedEvent(
      { id: '123e4567-e89b-42d3-a456-426614174000', title: 'Restored' } as any,
      'user-1',
    );

    relay.broadcastBoardUnarchived(event);

    expect(mockServer.to).toHaveBeenCalledWith(
      'board:123e4567-e89b-42d3-a456-426614174000',
    );
    expect(mockServer.emit).toHaveBeenCalledWith(WS_EVENTS.BOARD_UNARCHIVED, {
      boardId: '123e4567-e89b-42d3-a456-426614174000',
      board: expect.any(Object),
      unarchivedBy: { id: 'user-1' },
    });
  });

  it('should broadcast list:created on ListCreatedEvent', () => {
    const event = new ListCreatedEvent(
      {
        id: 'list-1',
        boardId: '123e4567-e89b-42d3-a456-426614174000',
        title: 'To Do',
      } as any,
      'user-1',
    );

    relay.broadcastListCreated(event);

    expect(mockServer.to).toHaveBeenCalledWith(
      'board:123e4567-e89b-42d3-a456-426614174000',
    );
    expect(mockServer.emit).toHaveBeenCalledWith(WS_EVENTS.LIST_CREATED, {
      list: event.list,
      createdBy: { id: 'user-1' },
    });
  });

  it('should broadcast list:updated on ListUpdatedEvent', () => {
    const event = new ListUpdatedEvent(
      {
        id: 'l-1',
        boardId: 'b-1',
        title: 'Doing',
        updatedAt: new Date(),
      } as any,
      'user-1',
    );

    relay.broadcastListUpdated(event);

    expect(mockServer.to).toHaveBeenCalledWith('board:b-1');
    expect(mockServer.emit).toHaveBeenCalledWith(WS_EVENTS.LIST_UPDATED, {
      listId: 'l-1',
      changes: { title: 'Doing', updatedAt: event.list.updatedAt },
      updatedBy: { id: 'user-1' },
    });
  });

  it('should broadcast list:moved on ListMovedEvent', () => {
    const event = new ListMovedEvent(
      'list-1',
      '123e4567-e89b-42d3-a456-426614174000',
      'rank-b',
      'user-1',
    );

    relay.broadcastListMoved(event);

    expect(mockServer.to).toHaveBeenCalledWith(
      'board:123e4567-e89b-42d3-a456-426614174000',
    );
    expect(mockServer.emit).toHaveBeenCalledWith(WS_EVENTS.LIST_MOVED, {
      listId: 'list-1',
      newRank: 'rank-b',
      movedBy: { id: 'user-1' },
    });
  });

  it('should broadcast list:archived on ListArchivedEvent', () => {
    const event = new ListArchivedEvent('l-1', 'b-1', 'u-1');

    relay.broadcastListArchived(event);

    expect(mockServer.to).toHaveBeenCalledWith('board:b-1');
    expect(mockServer.emit).toHaveBeenCalledWith(WS_EVENTS.LIST_ARCHIVED, {
      listId: 'l-1',
      archivedBy: { id: 'u-1' },
    });
  });

  it('should broadcast list:unarchived on ListUnarchivedEvent', () => {
    const event = new ListUnarchivedEvent(
      { id: 'l-1', boardId: 'b-1', title: 'Restored' } as any,
      'u-1',
    );

    relay.broadcastListUnarchived(event);

    expect(mockServer.to).toHaveBeenCalledWith('board:b-1');
    expect(mockServer.emit).toHaveBeenCalledWith(WS_EVENTS.LIST_UNARCHIVED, {
      listId: 'l-1',
      list: event.list,
      unarchivedBy: { id: 'u-1' },
    });
  });

  it('should broadcast card:created on CardCreatedEvent', () => {
    const event = new CardCreatedEvent(
      { id: 'card-1', title: 'Test Card' } as any,
      '123e4567-e89b-42d3-a456-426614174000',
      'list-1',
      'user-1',
    );

    relay.broadcastCardCreated(event);

    expect(mockServer.to).toHaveBeenCalledWith(
      'board:123e4567-e89b-42d3-a456-426614174000',
    );
    expect(mockServer.emit).toHaveBeenCalledWith(WS_EVENTS.CARD_CREATED, {
      card: event.card,
      listId: 'list-1',
      createdBy: { id: 'user-1' },
    });
  });

  it('should broadcast card:updated on CardUpdatedEvent', () => {
    const event = new CardUpdatedEvent(
      {
        id: 'c-1',
        title: 'Card',
        description: 'Desc',
        dueDate: null,
        isComplete: true,
        coverImageUrl: null,
        updatedAt: new Date(),
      } as any,
      'b-1',
      'u-1',
    );

    relay.broadcastCardUpdated(event);

    expect(mockServer.to).toHaveBeenCalledWith('board:b-1');
    expect(mockServer.emit).toHaveBeenCalledWith(WS_EVENTS.CARD_UPDATED, {
      cardId: 'c-1',
      changes: {
        title: 'Card',
        description: 'Desc',
        dueDate: null,
        isComplete: true,
        coverImageUrl: null,
        updatedAt: event.card.updatedAt,
      },
      updatedBy: { id: 'u-1' },
    });
  });

  it('should broadcast card:moved on CardMovedEvent', () => {
    const event = new CardMovedEvent(
      'card-1',
      '123e4567-e89b-42d3-a456-426614174000',
      'list-source',
      'list-target',
      'rank-x',
      'user-1',
    );

    relay.broadcastCardMoved(event);

    expect(mockServer.to).toHaveBeenCalledWith(
      'board:123e4567-e89b-42d3-a456-426614174000',
    );
    expect(mockServer.emit).toHaveBeenCalledWith(WS_EVENTS.CARD_MOVED, {
      cardId: 'card-1',
      fromListId: 'list-source',
      toListId: 'list-target',
      newRank: 'rank-x',
      movedBy: { id: 'user-1' },
    });
  });

  it('should broadcast card:archived on CardArchivedEvent', () => {
    const event = new CardArchivedEvent('c-1', 'b-1', 'l-1', 'u-1');

    relay.broadcastCardArchived(event);

    expect(mockServer.to).toHaveBeenCalledWith('board:b-1');
    expect(mockServer.emit).toHaveBeenCalledWith(WS_EVENTS.CARD_ARCHIVED, {
      cardId: 'c-1',
      listId: 'l-1',
      archivedBy: { id: 'u-1' },
    });
  });

  it('should broadcast card:unarchived on CardUnarchivedEvent', () => {
    const event = new CardUnarchivedEvent(
      { id: 'c-1', title: 'Restored' } as any,
      'b-1',
      'l-1',
      'u-1',
    );

    relay.broadcastCardUnarchived(event);

    expect(mockServer.to).toHaveBeenCalledWith('board:b-1');
    expect(mockServer.emit).toHaveBeenCalledWith(WS_EVENTS.CARD_UNARCHIVED, {
      cardId: 'c-1',
      card: event.card,
      listId: 'l-1',
      unarchivedBy: { id: 'u-1' },
    });
  });

  it('should broadcast card:comment-added on CommentCreatedEvent', () => {
    const event = new CommentCreatedEvent(
      { id: 'comment-1', cardId: 'card-1', content: 'Great job' } as any,
      '123e4567-e89b-42d3-a456-426614174000',
      'user-1',
    );

    relay.broadcastCommentCreated(event);

    expect(mockServer.to).toHaveBeenCalledWith(
      'board:123e4567-e89b-42d3-a456-426614174000',
    );
    expect(mockServer.emit).toHaveBeenCalledWith(WS_EVENTS.CARD_COMMENT_ADDED, {
      cardId: 'card-1',
      comment: event.comment,
      authorId: 'user-1',
    });
  });

  it('should broadcast card:attachment-added on AttachmentCreatedEvent', () => {
    const event = new AttachmentCreatedEvent(
      { id: 'att-1', cardId: 'card-1', fileName: 'diagram.png' } as any,
      '123e4567-e89b-42d3-a456-426614174000',
      'user-1',
    );

    relay.broadcastAttachmentCreated(event);

    expect(mockServer.to).toHaveBeenCalledWith(
      'board:123e4567-e89b-42d3-a456-426614174000',
    );
    expect(mockServer.emit).toHaveBeenCalledWith(
      WS_EVENTS.CARD_ATTACHMENT_ADDED,
      {
        cardId: 'card-1',
        attachment: event.attachment,
        uploadedBy: { id: 'user-1' },
      },
    );
  });

  it('should broadcast card:attachment-deleted on AttachmentDeletedEvent', () => {
    const event = new AttachmentDeletedEvent(
      'att-1',
      'card-1',
      '123e4567-e89b-42d3-a456-426614174000',
      'user-1',
    );

    relay.broadcastAttachmentDeleted(event);

    expect(mockServer.to).toHaveBeenCalledWith(
      'board:123e4567-e89b-42d3-a456-426614174000',
    );
    expect(mockServer.emit).toHaveBeenCalledWith(
      WS_EVENTS.CARD_ATTACHMENT_DELETED,
      {
        cardId: 'card-1',
        attachmentId: 'att-1',
        deletedBy: { id: 'user-1' },
      },
    );
  });

  it('should broadcast checklist:created on ChecklistCreatedEvent', () => {
    const event = new ChecklistCreatedEvent(
      { id: 'cl-1', cardId: 'card-1' } as any,
      '123e4567-e89b-42d3-a456-426614174000',
      'user-1',
    );

    relay.broadcastChecklistCreated(event);

    expect(mockServer.to).toHaveBeenCalledWith(
      'board:123e4567-e89b-42d3-a456-426614174000',
    );
    expect(mockServer.emit).toHaveBeenCalledWith(WS_EVENTS.CHECKLIST_CREATED, {
      checklist: event.checklist,
      createdBy: { id: 'user-1' },
    });
  });

  it('should broadcast checklist:updated on ChecklistUpdatedEvent', () => {
    const event = new ChecklistUpdatedEvent(
      'cl-1',
      'card-1',
      '123e4567-e89b-42d3-a456-426614174000',
      'user-1',
    );

    relay.broadcastChecklistUpdated(event);

    expect(mockServer.to).toHaveBeenCalledWith(
      'board:123e4567-e89b-42d3-a456-426614174000',
    );
    expect(mockServer.emit).toHaveBeenCalledWith(WS_EVENTS.CHECKLIST_UPDATED, {
      checklistId: 'cl-1',
      cardId: 'card-1',
      updatedBy: { id: 'user-1' },
    });
  });

  it('should broadcast checklist:deleted on ChecklistDeletedEvent', () => {
    const event = new ChecklistDeletedEvent(
      'cl-1',
      'card-1',
      '123e4567-e89b-42d3-a456-426614174000',
      'user-1',
    );

    relay.broadcastChecklistDeleted(event);

    expect(mockServer.to).toHaveBeenCalledWith(
      'board:123e4567-e89b-42d3-a456-426614174000',
    );
    expect(mockServer.emit).toHaveBeenCalledWith(WS_EVENTS.CHECKLIST_DELETED, {
      checklistId: 'cl-1',
      cardId: 'card-1',
      deletedBy: { id: 'user-1' },
    });
  });

  it('should broadcast card:comment-updated on CommentUpdatedEvent', () => {
    const event = new CommentUpdatedEvent(
      { id: 'cm-1', cardId: 'c-1' } as any,
      '123e4567-e89b-42d3-a456-426614174000',
      'user-2',
    );

    relay.broadcastCommentUpdated(event);

    expect(mockServer.to).toHaveBeenCalledWith(
      'board:123e4567-e89b-42d3-a456-426614174000',
    );
    expect(mockServer.emit).toHaveBeenCalledWith(
      WS_EVENTS.CARD_COMMENT_UPDATED,
      {
        cardId: 'c-1',
        comment: event.comment,
        updatedBy: { id: 'user-2' },
      },
    );
  });

  it('should broadcast card:comment-deleted on CommentDeletedEvent', () => {
    const event = new CommentDeletedEvent(
      'cm-1',
      'c-1',
      '123e4567-e89b-42d3-a456-426614174000',
      'user-2',
    );

    relay.broadcastCommentDeleted(event);

    expect(mockServer.to).toHaveBeenCalledWith(
      'board:123e4567-e89b-42d3-a456-426614174000',
    );
    expect(mockServer.emit).toHaveBeenCalledWith(
      WS_EVENTS.CARD_COMMENT_DELETED,
      {
        cardId: 'c-1',
        commentId: 'cm-1',
        deletedBy: { id: 'user-2' },
      },
    );
  });



  it('should broadcast card:assignee-added on CardAssigneeAddedEvent', () => {
    const event = new CardAssigneeAddedEvent(
      'c-1',
      '123e4567-e89b-42d3-a456-426614174000',
      'assignee-1',
      'user-1',
    );

    relay.broadcastCardAssigneeAdded(event);

    expect(mockServer.emit).toHaveBeenCalledWith(
      WS_EVENTS.CARD_ASSIGNEE_ADDED,
      {
        cardId: 'c-1',
        user: { id: 'assignee-1' },
        addedBy: { id: 'user-1' },
      },
    );
  });

  it('should broadcast card:assignee-removed on CardAssigneeRemovedEvent', () => {
    const event = new CardAssigneeRemovedEvent(
      'c-1',
      '123e4567-e89b-42d3-a456-426614174000',
      'assignee-1',
      'user-1',
    );

    relay.broadcastCardAssigneeRemoved(event);

    expect(mockServer.emit).toHaveBeenCalledWith(
      WS_EVENTS.CARD_ASSIGNEE_REMOVED,
      {
        cardId: 'c-1',
        user: { id: 'assignee-1' },
        removedBy: { id: 'user-1' },
      },
    );
  });

  it('should gracefully drop events when server is not attached across all broadcaster methods', () => {
    // Re-create without attachServer → all relays take the warn-and-drop path
    relay = new BroadcastRelayService();

    expect(() => {
      relay.broadcastBoardCreated(
        new BoardCreatedEvent({ workspaceId: 'ws-1' } as any, 'u-1'),
      );
      relay.broadcastBoardUpdated(
        new BoardUpdatedEvent({ id: 'b-1' } as any, 'u-1'),
      );
      relay.broadcastBoardArchived(
        new BoardArchivedEvent('b-1', 'ws-1', 'u-1'),
      );
      relay.broadcastBoardUnarchived(
        new BoardUnarchivedEvent({ id: 'b-1' } as any, 'u-1'),
      );
      relay.broadcastListCreated(
        new ListCreatedEvent({ boardId: 'b-1' } as any, 'u-1'),
      );
      relay.broadcastListUpdated(
        new ListUpdatedEvent({ id: 'l-1', boardId: 'b-1' } as any, 'u-1'),
      );
      relay.broadcastListMoved(new ListMovedEvent('l-1', 'b-1', 'rank', 'u-1'));
      relay.broadcastListArchived(new ListArchivedEvent('l-1', 'b-1', 'u-1'));
      relay.broadcastListUnarchived(
        new ListUnarchivedEvent({ id: 'l-1', boardId: 'b-1' } as any, 'u-1'),
      );
      relay.broadcastCardCreated(
        new CardCreatedEvent({} as any, 'b-1', 'l-1', 'u-1'),
      );
      relay.broadcastCardUpdated(
        new CardUpdatedEvent({ id: 'c-1' } as any, 'b-1', 'u-1'),
      );
      relay.broadcastCardMoved(
        new CardMovedEvent('c-1', 'b-1', 'l-1', 'l-2', 'r', 'u-1'),
      );
      relay.broadcastCardArchived(
        new CardArchivedEvent('c-1', 'b-1', 'l-1', 'u-1'),
      );
      relay.broadcastCardUnarchived(
        new CardUnarchivedEvent({ id: 'c-1' } as any, 'b-1', 'l-1', 'u-1'),
      );
      relay.broadcastCommentCreated(
        new CommentCreatedEvent({} as any, 'b-1', 'u-1'),
      );
      relay.broadcastCommentUpdated(
        new CommentUpdatedEvent({ cardId: 'c-1' } as any, 'b-1', 'u-1'),
      );
      relay.broadcastCommentDeleted(
        new CommentDeletedEvent('cm-1', 'c-1', 'b-1', 'u-1'),
      );
      relay.broadcastCardAssigneeAdded(
        new CardAssigneeAddedEvent('c-1', 'b-1', 'a-1', 'u-1'),
      );
      relay.broadcastCardAssigneeRemoved(
        new CardAssigneeRemovedEvent('c-1', 'b-1', 'a-1', 'u-1'),
      );
      relay.broadcastAttachmentCreated(
        new AttachmentCreatedEvent({} as any, 'b-1', 'u-1'),
      );
      relay.broadcastAttachmentDeleted(
        new AttachmentDeletedEvent('att-1', 'c-1', 'b-1', 'u-1'),
      );
      relay.broadcastChecklistCreated(
        new ChecklistCreatedEvent({} as any, 'b-1', 'u-1'),
      );
      relay.broadcastChecklistUpdated(
        new ChecklistUpdatedEvent('cl-1', 'c-1', 'b-1', 'u-1'),
      );
      relay.broadcastChecklistDeleted(
        new ChecklistDeletedEvent('cl-1', 'c-1', 'b-1', 'u-1'),
      );
    }).not.toThrow();
  });
});

describe('server-not-attached guard', () => {
  it('should warn and drop the event instead of throwing when server is not attached', () => {
    const unattached = new BroadcastRelayService();
    const warnSpy = jest.spyOn(unattached['logger'], 'warn');

    expect(() =>
      unattached.broadcastCardMoved(
        new CardMovedEvent('c-1', 'b-1', 'l-1', 'l-2', 'r', 'u-1'),
      ),
    ).not.toThrow();

    expect(warnSpy).toHaveBeenCalledWith(
      'Relay drop (card:moved): server not attached yet',
    );
  });
});
