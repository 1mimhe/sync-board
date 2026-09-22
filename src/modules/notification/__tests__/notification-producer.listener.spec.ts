import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotificationProducerListener } from '../listeners/notification-producer.listener';
import { RabbitPublisherService } from '../../../common/rabbitmq/publisher.service';
import { CardService } from '../../board/card/services/card.service';
import { BoardService } from '../../board/core/services/board.service';
import { MembershipService } from '../../workspace/services/membership.service';
import {
  CardAssigneeAddedEvent,
  CardStatusChangedEvent,
  CardPriorityChangedEvent,
} from '../../board/card/events/card.events';
import { CommentCreatedEvent } from '../../board/comment/events/comment.events';
import {
  WorkspaceMemberAddedEvent,
  WorkspaceMemberRoleChangedEvent,
} from '../../workspace/events/workspace.events';
import { WorkspaceRole } from '@prisma/client';

describe('NotificationProducerListener', () => {
  let listener: NotificationProducerListener;
  let publisher: { publish: jest.Mock };
  let config: { get: jest.Mock };
  let cardService: {
    findTitleById: jest.Mock;
    findAssigneeIdsByCardId: jest.Mock;
  };
  let boardService: { findWorkspaceIdByBoardId: jest.Mock };
  let membershipService: { findUserIdsByEmails: jest.Mock };

  beforeEach(async () => {
    publisher = { publish: jest.fn().mockResolvedValue(undefined) };
    config = { get: jest.fn().mockReturnValue(true) };
    cardService = {
      findTitleById: jest.fn().mockResolvedValue('Card A'),
      findAssigneeIdsByCardId: jest.fn().mockResolvedValue([]),
    };
    boardService = {
      findWorkspaceIdByBoardId: jest.fn().mockResolvedValue('ws-1'),
    };
    membershipService = {
      findUserIdsByEmails: jest.fn().mockResolvedValue(new Map()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationProducerListener,
        { provide: RabbitPublisherService, useValue: publisher },
        { provide: ConfigService, useValue: config },
        { provide: CardService, useValue: cardService },
        { provide: BoardService, useValue: boardService },
        { provide: MembershipService, useValue: membershipService },
      ],
    }).compile();
    listener = module.get(NotificationProducerListener);
  });

  it('publishes assignee notification with resolved title', async () => {
    await listener.handleAssigneeAdded(
      new CardAssigneeAddedEvent('c-1', 'b-1', 'u-assignee', 'u-actor'),
    );
    expect(publisher.publish).toHaveBeenCalledWith(
      expect.stringContaining('notification.exchange'),
      'notification.card.assigned',
      expect.objectContaining({
        userId: 'u-assignee',
        type: 'card_assigned',
        actorId: 'u-actor',
      }),
    );
  });

  it('skips self-assign', async () => {
    await listener.handleAssigneeAdded(
      new CardAssigneeAddedEvent('c-1', 'b-1', 'u-1', 'u-1'),
    );
    expect(publisher.publish).not.toHaveBeenCalled();
  });

  it('skips when workspace cannot be resolved', async () => {
    boardService.findWorkspaceIdByBoardId.mockResolvedValue(null);
    await listener.handleAssigneeAdded(
      new CardAssigneeAddedEvent('c-1', 'b-1', 'u-2', 'u-1'),
    );
    expect(publisher.publish).not.toHaveBeenCalled();
  });

  it('fans out comment to assignees minus author', async () => {
    cardService.findAssigneeIdsByCardId.mockResolvedValue([
      'u-author',
      'u-bob',
    ]);
    const event = new CommentCreatedEvent(
      { id: 'cm-1', cardId: 'c-1', content: 'hello' } as never,
      'b-1',
      'u-author',
      [],
    );
    await listener.handleCommentCreated(event);
    expect(publisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      'notification.comment.added',
      expect.objectContaining({ userId: 'u-bob' }),
    );
    expect(publisher.publish).not.toHaveBeenCalledWith(
      expect.anything(),
      'notification.comment.added',
      expect.objectContaining({ userId: 'u-author' }),
    );
  });

  it('skips comment fan-out when no recipients and no mentions', async () => {
    cardService.findAssigneeIdsByCardId.mockResolvedValue([]);
    await listener.handleCommentCreated(
      new CommentCreatedEvent(
        { id: 'cm-1', cardId: 'c-1', content: 'hi' } as never,
        'b-1',
        'u-a',
        [],
      ),
    );
    expect(publisher.publish).not.toHaveBeenCalled();
  });

  it('resolves mentions via event field and via fallback regex', async () => {
    cardService.findAssigneeIdsByCardId.mockResolvedValue([]);
    membershipService.findUserIdsByEmails.mockResolvedValue(
      new Map([['bob@x.com', 'u-bob']]),
    );
    await listener.handleCommentCreated(
      new CommentCreatedEvent(
        { id: 'cm-1', cardId: 'c-1', content: '@bob@x.com look' } as never,
        'b-1',
        'u-a',
        ['bob@x.com'],
      ),
    );
    expect(membershipService.findUserIdsByEmails).toHaveBeenCalledWith('ws-1', [
      'bob@x.com',
    ]);
    expect(publisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      'notification.comment.mentioned',
      expect.objectContaining({ userId: 'u-bob' }),
    );

    publisher.publish.mockClear();
    membershipService.findUserIdsByEmails.mockResolvedValue(
      new Map([['carol@x.com', 'u-carol']]),
    );
    await listener.handleCommentCreated(
      new CommentCreatedEvent(
        { id: 'cm-2', cardId: 'c-1', content: 'hey @carol@x.com' } as never,
        'b-1',
        'u-a',
        [],
      ),
    );
    expect(publisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      'notification.comment.mentioned',
      expect.objectContaining({ userId: 'u-carol' }),
    );
  });

  it('skips unknown mention emails', async () => {
    cardService.findAssigneeIdsByCardId.mockResolvedValue([]);
    membershipService.findUserIdsByEmails.mockResolvedValue(new Map());
    await listener.handleCommentCreated(
      new CommentCreatedEvent(
        { id: 'cm-1', cardId: 'c-1', content: '@ghost@x.com hi' } as never,
        'b-1',
        'u-a',
        ['ghost@x.com'],
      ),
    );
    expect(publisher.publish).not.toHaveBeenCalled();
  });

  it('publishes workspace invited and role-changed', async () => {
    await listener.handleMemberAdded(
      new WorkspaceMemberAddedEvent('ws-1', 'u-new', WorkspaceRole.member),
    );
    expect(publisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      'notification.workspace.invited',
      expect.objectContaining({ userId: 'u-new', type: 'workspace_invited' }),
    );
    publisher.publish.mockClear();
    await listener.handleMemberRoleChanged(
      new WorkspaceMemberRoleChangedEvent(
        'ws-1',
        'u-1',
        WorkspaceRole.member,
        WorkspaceRole.admin,
      ),
    );
    expect(publisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      'notification.workspace.role_changed',
      expect.objectContaining({ title: expect.stringContaining('admin') }),
    );
  });

  it('fans out status and priority to assignees minus actor', async () => {
    cardService.findAssigneeIdsByCardId.mockResolvedValue(['u-actor', 'u-bob']);
    await listener.handleStatusChanged(
      new CardStatusChangedEvent(
        'c-1',
        'b-1',
        'active',
        'done',
        true,
        'u-actor',
      ),
    );
    expect(publisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      'notification.card.status',
      expect.objectContaining({ userId: 'u-bob' }),
    );
    publisher.publish.mockClear();
    await listener.handlePriorityChanged(
      new CardPriorityChangedEvent('c-1', 'b-1', 'low', 'high', 'u-actor'),
    );
    expect(publisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      'notification.card.priority',
      expect.objectContaining({ userId: 'u-bob' }),
    );
  });

  it('no-ops when RABBITMQ_ENABLE=false', async () => {
    config.get.mockReturnValue(false);
    await listener.handleMemberAdded(
      new WorkspaceMemberAddedEvent('ws-1', 'u-1', WorkspaceRole.member),
    );
    expect(publisher.publish).not.toHaveBeenCalled();
  });

  it('swallows broker errors', async () => {
    publisher.publish.mockRejectedValue(new Error('broker down'));
    await expect(
      listener.handleMemberAdded(
        new WorkspaceMemberAddedEvent('ws-1', 'u-1', WorkspaceRole.member),
      ),
    ).resolves.not.toThrow();
  });
});
