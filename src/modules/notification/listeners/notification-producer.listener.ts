import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
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
import { parseMentionedEmails } from '../../board/comment/services/mention-parser.util';
import { WORKSPACE_EVENTS } from '../../workspace/events/workspace-events.constants';
import type {
  WorkspaceMemberAddedEvent,
  WorkspaceMemberRoleChangedEvent,
} from '../../workspace/events/workspace.events';
import {
  NOTIFICATION_ROUTING_KEYS,
  type NotificationMessagePayload,
} from '../notification.messages';

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

  private isEnabled(): boolean {
    return this.config.get<boolean>('RABBITMQ_ENABLE', true) !== false;
  }

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

  /** Notifies the assignee (skips self-assign noise). */
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

  /** Fans out comment notifications to assignees and @mentioned members. */
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
      const cardId = event.comment.cardId;
      const title = await this.cardService.findTitleById(cardId);
      const assigneeIds =
        await this.cardService.findAssigneeIdsByCardId(cardId);
      const recipients = assigneeIds.filter((id) => id !== event.authorId);
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
      const emails =
        event.mentionedEmails?.length > 0
          ? event.mentionedEmails
          : parseMentionedEmails(event.comment.content);
      if (emails.length === 0) return;
      const resolved = await this.membershipService.findUserIdsByEmails(
        workspaceId,
        emails,
      );
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
          cardId,
          actorId: event.authorId,
        });
      }
    } catch (error) {
      this.logger.error(
        'Comment notification producer failed',
        (error as Error).stack,
      );
    }
  }

  /** Unified invite-accept / direct-add notification. */
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

  /** Role-change notification to the affected member. */
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

  /** Status-change fan-out to assignees minus the actor. */
  @OnEvent(CARD_EVENTS.statusChanged)
  async handleStatusChanged(event: CardStatusChangedEvent): Promise<void> {
    try {
      const workspaceId = await this.resolveWorkspaceId(event.boardId);
      if (!workspaceId) return;
      const recipients = (
        await this.cardService.findAssigneeIdsByCardId(event.cardId)
      ).filter((id) => id !== event.changedBy);
      if (recipients.length === 0) return;
      const title = await this.cardService.findTitleById(event.cardId);
      for (const userId of recipients) {
        await this.publish(NOTIFICATION_ROUTING_KEYS.cardStatusChanged, {
          userId,
          workspaceId,
          type: 'card_status_changed',
          title: `Card "${title ?? 'a card'}" moved to ${event.to}`,
          entityType: 'card',
          entityId: event.cardId,
          boardId: event.boardId,
          cardId: event.cardId,
          actorId: event.changedBy,
        });
      }
    } catch (error) {
      this.logger.error(
        'Status notification producer failed',
        (error as Error).stack,
      );
    }
  }

  /** Priority-change fan-out to assignees minus the actor. */
  @OnEvent(CARD_EVENTS.priorityChanged)
  async handlePriorityChanged(event: CardPriorityChangedEvent): Promise<void> {
    try {
      const workspaceId = await this.resolveWorkspaceId(event.boardId);
      if (!workspaceId) return;
      const recipients = (
        await this.cardService.findAssigneeIdsByCardId(event.cardId)
      ).filter((id) => id !== event.changedBy);
      if (recipients.length === 0) return;
      const title = await this.cardService.findTitleById(event.cardId);
      for (const userId of recipients) {
        await this.publish(NOTIFICATION_ROUTING_KEYS.cardPriorityChanged, {
          userId,
          workspaceId,
          type: 'card_priority_changed',
          title: `Card "${title ?? 'a card'}" priority changed to ${event.to}`,
          entityType: 'card',
          entityId: event.cardId,
          boardId: event.boardId,
          cardId: event.cardId,
          actorId: event.changedBy,
        });
      }
    } catch (error) {
      this.logger.error(
        'Priority notification producer failed',
        (error as Error).stack,
      );
    }
  }
}
