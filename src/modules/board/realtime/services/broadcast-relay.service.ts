import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Server } from 'socket.io';
import { WS_EVENTS } from '../ws-events.constants';
import { BOARD_EVENTS } from '../../board/events/board-events.constants';
import { LIST_EVENTS } from '../../list/events/list-events.constants';
import { CARD_EVENTS } from '../../card/events/card-events.constants';
import { COMMENT_EVENTS } from '../../comment/events/comment-events.constants';
import { ATTACHMENT_EVENTS } from '../../attachment/events/attachment-events.constants';
import { CHECKLIST_EVENTS } from '../../checklist/events/checklist.events';
import type {
  BoardCreatedEvent,
  BoardUpdatedEvent,
  BoardArchivedEvent,
  BoardUnarchivedEvent,
} from '../../board/events/board.events';
import type {
  ListCreatedEvent,
  ListUpdatedEvent,
  ListMovedEvent,
  ListArchivedEvent,
  ListUnarchivedEvent,
} from '../../list/events/list.events';
import type {
  CardCreatedEvent,
  CardUpdatedEvent,
  CardMovedEvent,
  CardArchivedEvent,
  CardUnarchivedEvent,
} from '../../card/events/card.events';
import type { CommentCreatedEvent } from '../../comment/events/comment.events';
import type {
  AttachmentCreatedEvent,
  AttachmentDeletedEvent,
} from '../../attachment/events/attachment.events';
import type {
  ChecklistCreatedEvent,
  ChecklistUpdatedEvent,
  ChecklistDeletedEvent,
} from '../../checklist/events/checklist.events';

/**
 * Receives internal domain events (@OnEvent) and relays them to board rooms
 * as WebSocket events. Holds NO client-handler logic.
 *
 * The Socket.IO server instance is injected by the gateway during bootstrap.
 */
@Injectable()
export class BroadcastRelayService {
  private readonly logger = new Logger(BroadcastRelayService.name);
  private server?: Server;

  /** Called once by the gateway on application bootstrap. */
  attachServer(server: Server): void {
    this.server = server;
  }

  private toBoard(boardId: string, event: string, payload: unknown): void {
    if (!this.server) {
      this.logger.warn(`Relay drop (${event}): server not attached yet`);
      return;
    }
    this.server.to(`board:${boardId}`).emit(event, payload);
  }

  private toWorkspace(
    workspaceId: string,
    event: string,
    payload: unknown,
  ): void {
    if (!this.server) {
      this.logger.warn(`Relay drop (${event}): server not attached yet`);
      return;
    }
    this.server.to(`workspace:${workspaceId}`).emit(event, payload);
  }

  // --- Board Events ---

  @OnEvent(BOARD_EVENTS.created)
  broadcastBoardCreated(event: BoardCreatedEvent): void {
    this.toWorkspace(event.board.workspaceId, WS_EVENTS.BOARD_CREATED, {
      board: event.board,
      createdBy: { id: event.createdBy },
    });
  }

  @OnEvent(BOARD_EVENTS.updated)
  broadcastBoardUpdated(event: BoardUpdatedEvent): void {
    this.toBoard(event.board.id, WS_EVENTS.BOARD_UPDATED, {
      boardId: event.board.id,
      changes: {
        title: event.board.title,
        description: event.board.description,
        backgroundColor: event.board.backgroundColor,
        updatedAt: event.board.updatedAt,
      },
      updatedBy: { id: event.updatedBy },
    });
  }

  @OnEvent(BOARD_EVENTS.archived)
  broadcastBoardArchived(event: BoardArchivedEvent): void {
    this.toBoard(event.boardId, WS_EVENTS.BOARD_ARCHIVED, {
      boardId: event.boardId,
      archivedBy: { id: event.archivedBy },
    });
  }

  @OnEvent(BOARD_EVENTS.unarchived)
  broadcastBoardUnarchived(event: BoardUnarchivedEvent): void {
    this.toBoard(event.board.id, WS_EVENTS.BOARD_UNARCHIVED, {
      boardId: event.board.id,
      board: event.board,
      unarchivedBy: { id: event.unarchivedBy },
    });
  }

  // --- List Events ---

  @OnEvent(LIST_EVENTS.created)
  broadcastListCreated(event: ListCreatedEvent): void {
    this.toBoard(event.list.boardId, WS_EVENTS.LIST_CREATED, {
      list: event.list,
      createdBy: { id: event.createdBy },
    });
  }

  @OnEvent(LIST_EVENTS.updated)
  broadcastListUpdated(event: ListUpdatedEvent): void {
    this.toBoard(event.list.boardId, WS_EVENTS.LIST_UPDATED, {
      listId: event.list.id,
      changes: {
        title: event.list.title,
        updatedAt: event.list.updatedAt,
      },
      updatedBy: { id: event.updatedBy },
    });
  }

  @OnEvent(LIST_EVENTS.moved)
  broadcastListMoved(event: ListMovedEvent): void {
    this.toBoard(event.boardId, WS_EVENTS.LIST_MOVED, {
      listId: event.listId,
      newRank: event.newRank,
      movedBy: { id: event.movedBy },
    });
  }

  @OnEvent(LIST_EVENTS.archived)
  broadcastListArchived(event: ListArchivedEvent): void {
    this.toBoard(event.boardId, WS_EVENTS.LIST_ARCHIVED, {
      listId: event.listId,
      archivedBy: { id: event.archivedBy },
    });
  }

  @OnEvent(LIST_EVENTS.unarchived)
  broadcastListUnarchived(event: ListUnarchivedEvent): void {
    this.toBoard(event.list.boardId, WS_EVENTS.LIST_UNARCHIVED, {
      listId: event.list.id,
      list: event.list,
      unarchivedBy: { id: event.unarchivedBy },
    });
  }

  // --- Card Events ---

  @OnEvent(CARD_EVENTS.created)
  broadcastCardCreated(event: CardCreatedEvent): void {
    this.toBoard(event.boardId, WS_EVENTS.CARD_CREATED, {
      card: event.card,
      listId: event.listId,
      createdBy: { id: event.createdBy },
    });
  }

  @OnEvent(CARD_EVENTS.updated)
  broadcastCardUpdated(event: CardUpdatedEvent): void {
    this.toBoard(event.boardId, WS_EVENTS.CARD_UPDATED, {
      cardId: event.card.id,
      changes: {
        title: event.card.title,
        description: event.card.description,
        dueDate: event.card.dueDate,
        isComplete: event.card.isComplete,
        coverImageUrl: event.card.coverImageUrl,
        updatedAt: event.card.updatedAt,
      },
      updatedBy: { id: event.updatedBy },
    });
  }

  @OnEvent(CARD_EVENTS.moved)
  broadcastCardMoved(event: CardMovedEvent): void {
    this.toBoard(event.boardId, WS_EVENTS.CARD_MOVED, {
      cardId: event.cardId,
      fromListId: event.sourceListId,
      toListId: event.targetListId,
      newRank: event.newRank,
      movedBy: { id: event.movedBy },
    });
  }

  @OnEvent(CARD_EVENTS.archived)
  broadcastCardArchived(event: CardArchivedEvent): void {
    this.toBoard(event.boardId, WS_EVENTS.CARD_ARCHIVED, {
      cardId: event.cardId,
      listId: event.listId,
      archivedBy: { id: event.archivedBy },
    });
  }

  @OnEvent(CARD_EVENTS.unarchived)
  broadcastCardUnarchived(event: CardUnarchivedEvent): void {
    this.toBoard(event.boardId, WS_EVENTS.CARD_UNARCHIVED, {
      cardId: event.card.id,
      card: event.card,
      listId: event.listId,
      unarchivedBy: { id: event.unarchivedBy },
    });
  }

  // --- Comment Events ---

  @OnEvent(COMMENT_EVENTS.created)
  broadcastCommentCreated(event: CommentCreatedEvent): void {
    this.toBoard(event.boardId, WS_EVENTS.CARD_COMMENT_ADDED, {
      cardId: event.comment.cardId,
      comment: event.comment,
      authorId: event.authorId,
    });
  }

  // --- Attachment Events ---

  @OnEvent(ATTACHMENT_EVENTS.created)
  broadcastAttachmentCreated(event: AttachmentCreatedEvent): void {
    this.toBoard(event.boardId, WS_EVENTS.CARD_ATTACHMENT_ADDED, {
      cardId: event.attachment.cardId,
      attachment: event.attachment,
      uploadedBy: { id: event.uploadedBy },
    });
  }

  @OnEvent(ATTACHMENT_EVENTS.deleted)
  broadcastAttachmentDeleted(event: AttachmentDeletedEvent): void {
    this.toBoard(event.boardId, WS_EVENTS.CARD_ATTACHMENT_DELETED, {
      cardId: event.cardId,
      attachmentId: event.attachmentId,
      deletedBy: { id: event.deletedBy },
    });
  }

  // --- Checklist Events ---

  @OnEvent(CHECKLIST_EVENTS.created)
  broadcastChecklistCreated(event: ChecklistCreatedEvent): void {
    this.toBoard(event.boardId, WS_EVENTS.CHECKLIST_CREATED, {
      checklist: event.checklist,
      createdBy: { id: event.createdBy },
    });
  }

  @OnEvent(CHECKLIST_EVENTS.updated)
  broadcastChecklistUpdated(event: ChecklistUpdatedEvent): void {
    this.toBoard(event.boardId, WS_EVENTS.CHECKLIST_UPDATED, {
      checklistId: event.checklistId,
      cardId: event.cardId,
      updatedBy: { id: event.updatedBy },
    });
  }

  @OnEvent(CHECKLIST_EVENTS.deleted)
  broadcastChecklistDeleted(event: ChecklistDeletedEvent): void {
    this.toBoard(event.boardId, WS_EVENTS.CHECKLIST_DELETED, {
      checklistId: event.checklistId,
      cardId: event.cardId,
      deletedBy: { id: event.deletedBy },
    });
  }
}
