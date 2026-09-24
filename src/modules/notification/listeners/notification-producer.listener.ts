import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import type { NotificationType } from '@prisma/client';
import { RabbitPublisherService } from '../../../common/rabbitmq/publisher.service';
import { EXCHANGES } from '../../../common/rabbitmq/rabbitmq.constants';
import { CardService } from '../../board/card/services/card.service';
import { BoardService } from '../../board/core/services/board.service';
import { MembershipService } from '../../workspace/services/membership.service';
import { CARD_EVENTS } from '../../board/card/events/card-events.constants';
import type {
  CardAssigneeAddedEvent,
  CardPriorityChangedEvent,
  CardStatusChangedEvent,
} from '../../board/card/events/card.events';
import { COMMENT_EVENTS } from '../../board/comment/events/comment-events.constants';
import type { CommentCreatedEvent } from '../../board/comment/events/comment.events';
import { parseMentionedEmails } from '../../board/comment/utils/mention-parser.util';
import { WORKSPACE_EVENTS } from '../../workspace/events/workspace-events.constants';
import type {
  WorkspaceMemberAddedEvent,
  WorkspaceMemberRoleChangedEvent,
} from '../../workspace/events/workspace.events';
import { NOTIFICATION_ROUTING_KEYS } from '../constants/notification-routing.constants';
import type { NotificationMessagePayload } from '../interfaces/notification-message.interface';

/**
 * Domain-event fan-out producing idempotent notification messages.
 * Fail-open: producer errors are logged and never break the source flow.
 */
@Injectable()
export class NotificationProducerListener {
  private readonly logger = new Logger(NotificationProducerListener.name);

  constructor(
    private readonly publisher: RabbitPublisherService,
    private readonly config: ConfigService,
    private readonly cardService: CardService,
    private readonly boardService: BoardService,
    private readonly membershipService: MembershipService,
  ) {}

  /**
   * Whether the RabbitMQ pipeline is enabled.
   *
   * @returns False when disabled via RABBITMQ_ENABLE (tests, degraded mode)
   */
  private isEnabled(): boolean {
    return this.config.get<boolean>('RABBITMQ_ENABLE', true) !== false;
  }

  /**
   * Publishes one notification message, swallowing broker errors.
   *
   * @param routingKey - Notification routing key
   * @param payload - Recipient, type, title, and entity references
   * @returns Promise resolving when published or skipped
   */
  private async publish(
    routingKey: string,
    payload: NotificationMessagePayload,
  ): Promise<void> {
    if (!this.isEnabled()) return;
    try {
      await this.publisher.publish(EXCHANGES.NOTIFICATION, routingKey, payload);
    } catch (error) {
      this.logger.error(
        `Notification publish failed ${routingKey}`,
        (error as Error).stack,
      );
    }
  }

  /**
   * Resolves the owning workspace for board-scoped events.
   *
   * @param boardId - Board UUID
   * @returns Workspace UUID, or null when the board is unknown
   */
  private async resolveWorkspaceId(boardId: string): Promise<string | null> {
    try {
      return await this.boardService.findWorkspaceIdByBoardId(boardId);
    } catch (error) {
      this.logger.warn(`Workspace resolution failed for board ${boardId}`, {
        error: (error as Error).message,
      });
      return null;
    }
  }

  /**
   * Publishes a card-change notification to every assignee except the actor.
   *
   * @param boardId - Board UUID scoping the card
   * @param cardId - Changed card UUID
   * @param actorId - Acting user UUID (excluded from recipients)
   * @param routingKey - Notification routing key
   * @param type - Notification type
   * @param title - Title builder receiving the resolved card title
   * @returns Promise resolving when all recipient messages are published
   */
  private async fanOutToAssignees(params: {
    boardId: string;
    cardId: string;
    actorId: string;
    routingKey: string;
    type: NotificationType;
    title: (cardTitle: string) => string;
  }): Promise<void> {
    const workspaceId = await this.resolveWorkspaceId(params.boardId);
    if (!workspaceId) return;
    const recipients = (
      await this.cardService.findAssigneeIdsByCardId(params.cardId)
    ).filter((id) => id !== params.actorId);
    if (recipients.length === 0) return;
    const cardTitle = await this.cardService.findTitleById(params.cardId);
    for (const userId of recipients) {
      await this.publish(params.routingKey, {
        userId,
        workspaceId,
        type: params.type,
        title: params.title(cardTitle ?? 'a card'),
        entityType: 'card',
        entityId: params.cardId,
        boardId: params.boardId,
        cardId: params.cardId,
        actorId: params.actorId,
      });
    }
  }

  /**
   * Notifies the assignee of a new assignment.
   *
   * @param event - Assignee-added domain event
   * @returns Promise resolving when the notification is published
   */
  @OnEvent(CARD_EVENTS.assigneeAdded)
  async handleAssigneeAdded(event: CardAssigneeAddedEvent): Promise<void> {
    try {
      if (event.userId === event.addedBy) return;
      const workspaceId = await this.resolveWorkspaceId(event.boardId);
      if (!workspaceId) {
        this.logger.warn('Skipping assignee notification: unknown workspace', {
          boardId: event.boardId,
        });
        return;
      }
      const title = await this.cardService.findTitleById(event.cardId);
      await this.publish(NOTIFICATION_ROUTING_KEYS.cardAssigned, {
        userId: event.userId,
        workspaceId,
        type: 'card_assigned',
        title: `You were assigned to "${title ?? 'a card'}"`,
        entityType: 'card',
        entityId: event.cardId,
        boardId: event.boardId,
        cardId: event.cardId,
        actorId: event.addedBy,
      });
    } catch (error) {
      this.logger.error(
        'Assignee notification producer failed',
        (error as Error).stack,
      );
    }
  }

  /**
   * Fans out comment notifications to assignees and @mentioned members.
   *
   * @param event - Comment-created domain event
   * @returns Promise resolving when all notifications are published
   */
  @OnEvent(COMMENT_EVENTS.created)
  async handleCommentCreated(event: CommentCreatedEvent): Promise<void> {
    try {
      const workspaceId = await this.resolveWorkspaceId(event.boardId);
      if (!workspaceId) {
        this.logger.warn('Skipping comment notification: unknown workspace', {
          boardId: event.boardId,
        });
        return;
      }
      await this.notifyCommentAssignees(event, workspaceId);
      await this.notifyMentionedUsers(event, workspaceId);
    } catch (error) {
      this.logger.error(
        'Comment notification producer failed',
        (error as Error).stack,
      );
    }
  }

  /**
   * Notifies card assignees (minus the author) about a new comment.
   *
   * @param event - Comment-created domain event
   * @param workspaceId - Owning workspace UUID
   * @returns Promise resolving when assignee notifications are published
   */
  private async notifyCommentAssignees(
    event: CommentCreatedEvent,
    workspaceId: string,
  ): Promise<void> {
    const cardId = event.comment.cardId;
    const title = await this.cardService.findTitleById(cardId);
    const recipients = (
      await this.cardService.findAssigneeIdsByCardId(cardId)
    ).filter((id) => id !== event.authorId);
    const body = event.comment.content.slice(0, 200);
    for (const userId of recipients) {
      await this.publish(NOTIFICATION_ROUTING_KEYS.commentAdded, {
        userId,
        workspaceId,
        type: 'comment_added',
        title: `New comment on "${title ?? 'a card'}"`,
        body,
        entityType: 'comment',
        entityId: event.comment.id,
        boardId: event.boardId,
        cardId,
        actorId: event.authorId,
      });
    }
  }

  /**
   * Notifies workspace members @mentioned in a comment.
   *
   * @param event - Comment-created domain event
   * @param workspaceId - Owning workspace UUID
   * @returns Promise resolving when mention notifications are published
   */
  private async notifyMentionedUsers(
    event: CommentCreatedEvent,
    workspaceId: string,
  ): Promise<void> {
    const emails =
      event.mentionedEmails?.length > 0
        ? event.mentionedEmails
        : parseMentionedEmails(event.comment.content);
    if (emails.length === 0) return;
    const resolved = await this.membershipService.findUserIdsByEmails(
      workspaceId,
      emails,
    );
    const body = event.comment.content.slice(0, 200);
    for (const [, userId] of resolved) {
      await this.publish(NOTIFICATION_ROUTING_KEYS.commentMentioned, {
        userId,
        workspaceId,
        type: 'comment_mentioned',
        title: 'You were mentioned in a comment',
        body,
        entityType: 'comment',
        entityId: event.comment.id,
        boardId: event.boardId,
        cardId: event.comment.cardId,
        actorId: event.authorId,
      });
    }
  }

  /**
   * Sends the unified invite-accept / direct-add notification.
   *
   * @param event - Workspace member-added domain event
   * @returns Promise resolving when the notification is published
   */
  @OnEvent(WORKSPACE_EVENTS.memberAdded)
  async handleMemberAdded(event: WorkspaceMemberAddedEvent): Promise<void> {
    try {
      await this.publish(NOTIFICATION_ROUTING_KEYS.workspaceInvited, {
        userId: event.userId,
        workspaceId: event.workspaceId,
        type: 'workspace_invited',
        title: "You've been added to a workspace",
        entityType: 'workspace',
        entityId: event.workspaceId,
      });
    } catch (error) {
      this.logger.error(
        'Workspace-invited notification producer failed',
        (error as Error).stack,
      );
    }
  }

  /**
   * Notifies the affected member about a role change.
   *
   * @param event - Workspace member role-changed domain event
   * @returns Promise resolving when the notification is published
   */
  @OnEvent(WORKSPACE_EVENTS.memberRoleChanged)
  async handleMemberRoleChanged(
    event: WorkspaceMemberRoleChangedEvent,
  ): Promise<void> {
    try {
      await this.publish(NOTIFICATION_ROUTING_KEYS.workspaceRoleChanged, {
        userId: event.userId,
        workspaceId: event.workspaceId,
        type: 'workspace_role_changed',
        title: `Your role changed to ${event.newRole}`,
        entityType: 'workspace',
        entityId: event.workspaceId,
      });
    } catch (error) {
      this.logger.error(
        'Role-changed notification producer failed',
        (error as Error).stack,
      );
    }
  }

  /**
   * Fans out card status changes to assignees minus the actor.
   *
   * @param event - Card status-changed domain event
   * @returns Promise resolving when all notifications are published
   */
  @OnEvent(CARD_EVENTS.statusChanged)
  async handleStatusChanged(event: CardStatusChangedEvent): Promise<void> {
    try {
      await this.fanOutToAssignees({
        boardId: event.boardId,
        cardId: event.cardId,
        actorId: event.changedBy,
        routingKey: NOTIFICATION_ROUTING_KEYS.cardStatusChanged,
        type: 'card_status_changed',
        title: (card) => `Card "${card}" moved to ${event.to}`,
      });
    } catch (error) {
      this.logger.error(
        'Status notification producer failed',
        (error as Error).stack,
      );
    }
  }

  /**
   * Fans out card priority changes to assignees minus the actor.
   *
   * @param event - Card priority-changed domain event
   * @returns Promise resolving when all notifications are published
   */
  @OnEvent(CARD_EVENTS.priorityChanged)
  async handlePriorityChanged(event: CardPriorityChangedEvent): Promise<void> {
    try {
      await this.fanOutToAssignees({
        boardId: event.boardId,
        cardId: event.cardId,
        actorId: event.changedBy,
        routingKey: NOTIFICATION_ROUTING_KEYS.cardPriorityChanged,
        type: 'card_priority_changed',
        title: (card) => `Card "${card}" priority changed to ${event.to}`,
      });
    } catch (error) {
      this.logger.error(
        'Priority notification producer failed',
        (error as Error).stack,
      );
    }
  }
}
