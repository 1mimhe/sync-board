import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { CardCommentService } from '../../services/comment.service';
import { CardCommentRepository } from '../../repositories/comment.repository';
import { CardRepository } from '../../../card/repositories/card.repository';
import { BoardRepository } from '../../../core/repositories/board.repository';
import { EntityNotFoundException } from '../../../../../common/exceptions/app.exception';
import { ForbiddenException } from '@nestjs/common';
import { COMMENT_EVENTS } from '../../../comment/events/comment-events.constants';

describe('CardCommentService', () => {
  let service: CardCommentService;
  let commentRepo: DeepMockProxy<CardCommentRepository>;
  let cardRepo: DeepMockProxy<CardRepository>;
  let boardRepo: DeepMockProxy<BoardRepository>;
  let eventEmitter: DeepMockProxy<EventEmitter2>;

  beforeEach(async () => {
    commentRepo = mockDeep<CardCommentRepository>();
    cardRepo = mockDeep<CardRepository>();
    boardRepo = mockDeep<BoardRepository>();
    eventEmitter = mockDeep<EventEmitter2>();

    boardRepo.findById.mockResolvedValue({ id: 'board-uuid' } as any);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CardCommentService,
        { provide: CardCommentRepository, useValue: commentRepo },
        { provide: CardRepository, useValue: cardRepo },
        { provide: BoardRepository, useValue: boardRepo },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<CardCommentService>(CardCommentService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should throw EntityNotFoundException if board does not exist', async () => {
    boardRepo.findById.mockResolvedValue(null);

    await expect(
      service.getCardComments('nonexistent-board', 'ws-uuid', 'card-uuid'),
    ).rejects.toThrow(EntityNotFoundException);
  });

  describe('create', () => {
    it('should create comment and emit event', async () => {
      cardRepo.findActiveById.mockResolvedValue({ id: 'card-uuid' } as any);
      const mockComment = {
        id: 'comm-1',
        cardId: 'card-uuid',
        authorId: 'user-1',
        content: 'Nice job',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        author: { id: 'user-1', displayName: 'Jane', avatarUrl: null },
      };
      commentRepo.create.mockResolvedValue(mockComment);

      const result = await service.create(
        'board-uuid',
        'ws-uuid',
        'card-uuid',
        { content: 'Nice job' },
        'user-1',
      );

      expect(result).toEqual(mockComment);
      expect(commentRepo.create).toHaveBeenCalledWith({
        cardId: 'card-uuid',
        authorId: 'user-1',
        content: 'Nice job',
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        COMMENT_EVENTS.created,
        expect.any(Object),
      );
    });
  });

  describe('getCardComments', () => {
    const baseComment = {
      id: 'comment-uuid',
      cardId: 'card-uuid',
      authorId: 'user-uuid',
      content: 'Looking good',
      author: { id: 'user-uuid', displayName: 'John', avatarUrl: null },
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    function makeComment(id: string) {
      return { ...baseComment, id };
    }

    beforeEach(() => {
      cardRepo.findActiveById.mockResolvedValue({ id: 'card-uuid' } as any);
    });

    it('should return first page with hasMore true and cursor of last item when repo returns limit + 1 rows', async () => {
      const rows = Array.from({ length: 21 }, (_, i) => makeComment(`c-${i}`));
      commentRepo.findCardCommentsPage.mockResolvedValue(rows);

      const result = await service.getCardComments(
        'board-uuid',
        'ws-uuid',
        'card-uuid',
        { limit: 20 },
      );

      expect(result.items).toHaveLength(20);
      expect(result.items[19]).toEqual(rows[19]);
      expect(result.pagination).toEqual({
        cursor: 'c-19',
        hasMore: true,
      });
      expect(commentRepo.findCardCommentsPage).toHaveBeenCalledWith(
        'card-uuid',
        undefined,
        20,
      );
    });

    it('should return last page with hasMore false and null cursor when repo returns fewer than limit rows', async () => {
      const rows = [makeComment('c-1'), makeComment('c-2')];
      commentRepo.findCardCommentsPage.mockResolvedValue(rows);

      const result = await service.getCardComments(
        'board-uuid',
        'ws-uuid',
        'card-uuid',
        { cursor: 'c-0', limit: 20 },
      );

      expect(result.items).toEqual(rows);
      expect(result.pagination).toEqual({
        cursor: null,
        hasMore: false,
      });
      expect(commentRepo.findCardCommentsPage).toHaveBeenCalledWith(
        'card-uuid',
        'c-0',
        20,
      );
    });

    it('should apply default limit of 20 when query is omitted', async () => {
      commentRepo.findCardCommentsPage.mockResolvedValue([]);

      const result = await service.getCardComments(
        'board-uuid',
        'ws-uuid',
        'card-uuid',
      );

      expect(commentRepo.findCardCommentsPage).toHaveBeenCalledWith(
        'card-uuid',
        undefined,
        20,
      );
      expect(result.items).toEqual([]);
      expect(result.pagination).toEqual({ cursor: null, hasMore: false });
    });

    it('should throw EntityNotFoundException when card does not exist', async () => {
      cardRepo.findActiveById.mockResolvedValue(null);

      await expect(
        service.getCardComments('board-uuid', 'ws-uuid', 'nonexistent-uuid'),
      ).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe('update', () => {
    it('should update comment text if author matches', async () => {
      cardRepo.findActiveById.mockResolvedValue({ id: 'card-uuid' } as any);
      commentRepo.findActiveById.mockResolvedValue({
        id: 'comm-1',
        authorId: 'user-1',
        content: 'Old text',
      } as any);
      commentRepo.update.mockResolvedValue({
        id: 'comm-1',
        content: 'New text',
      } as any);

      const result = await service.update(
        'board-uuid',
        'ws-uuid',
        'card-uuid',
        'comm-1',
        { content: 'New text' },
        'user-1',
      );

      expect(result.content).toBe('New text');
      expect(commentRepo.update).toHaveBeenCalledWith('comm-1', 'New text');
      expect(eventEmitter.emit).toHaveBeenCalledWith(COMMENT_EVENTS.updated, {
        comment: { id: 'comm-1', content: 'New text' },
        boardId: 'board-uuid',
        updatedBy: 'user-1',
      } as any);
    });

    it('should throw ForbiddenException if user is not comment author during update', async () => {
      cardRepo.findActiveById.mockResolvedValue({ id: 'card-uuid' } as any);
      commentRepo.findActiveById.mockResolvedValue({
        id: 'comm-1',
        authorId: 'other-user',
        content: 'Old text',
      } as any);

      await expect(
        service.update(
          'board-uuid',
          'ws-uuid',
          'card-uuid',
          'comm-1',
          { content: 'New text' },
          'user-1',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw EntityNotFoundException if comment not found during update', async () => {
      cardRepo.findActiveById.mockResolvedValue({ id: 'card-uuid' } as any);
      commentRepo.findActiveById.mockResolvedValue(null);

      await expect(
        service.update(
          'board-uuid',
          'ws-uuid',
          'card-uuid',
          'comm-99',
          { content: 'New text' },
          'user-1',
        ),
      ).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe('delete', () => {
    it('should soft delete comment if author matches', async () => {
      cardRepo.findActiveById.mockResolvedValue({ id: 'card-uuid' } as any);
      commentRepo.findActiveById.mockResolvedValue({
        id: 'comm-1',
        authorId: 'user-1',
      } as any);
      commentRepo.softDelete.mockResolvedValue(undefined);

      await service.delete(
        'board-uuid',
        'ws-uuid',
        'card-uuid',
        'comm-1',
        'user-1',
      );

      expect(commentRepo.softDelete).toHaveBeenCalledWith('comm-1');
      expect(eventEmitter.emit).toHaveBeenCalledWith(COMMENT_EVENTS.deleted, {
        commentId: 'comm-1',
        cardId: 'card-uuid',
        boardId: 'board-uuid',
        deletedBy: 'user-1',
      } as any);
    });

    it('should throw ForbiddenException if user is not author during delete', async () => {
      cardRepo.findActiveById.mockResolvedValue({ id: 'card-uuid' } as any);
      commentRepo.findActiveById.mockResolvedValue({
        id: 'comm-1',
        authorId: 'other-user',
      } as any);

      await expect(
        service.delete(
          'board-uuid',
          'ws-uuid',
          'card-uuid',
          'comm-1',
          'user-1',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw EntityNotFoundException if comment not found during delete', async () => {
      cardRepo.findActiveById.mockResolvedValue({ id: 'card-uuid' } as any);
      commentRepo.findActiveById.mockResolvedValue(null);

      await expect(
        service.delete(
          'board-uuid',
          'ws-uuid',
          'card-uuid',
          'comm-99',
          'user-1',
        ),
      ).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe('create with parentCommentId', () => {
    it('should create reply when parent is top-level', async () => {
      cardRepo.findActiveById.mockResolvedValue({ id: 'card-uuid' } as any);
      commentRepo.findActiveById.mockResolvedValue({
        id: 'parent-1',
        parentCommentId: null,
      } as any);
      commentRepo.create.mockResolvedValue({ id: 'reply-1' } as any);

      const result = await service.create(
        'board-uuid',
        'ws-uuid',
        'card-uuid',
        { content: 'Reply', parentCommentId: 'parent-1' },
        'user-1',
      );

      expect(result).toEqual({ id: 'reply-1' });
    });

    it('should throw when parent comment not found', async () => {
      cardRepo.findActiveById.mockResolvedValue({ id: 'card-uuid' } as any);
      commentRepo.findActiveById.mockResolvedValue(null);

      await expect(
        service.create(
          'board-uuid',
          'ws-uuid',
          'card-uuid',
          { content: 'Reply', parentCommentId: 'missing' } as any,
          'user-1',
        ),
      ).rejects.toThrow(EntityNotFoundException);
    });

    it('should throw MAX_THREAD_DEPTH when replying to a reply', async () => {
      cardRepo.findActiveById.mockResolvedValue({ id: 'card-uuid' } as any);
      commentRepo.findActiveById.mockResolvedValue({
        id: 'reply-1',
        parentCommentId: 'parent-1',
      } as any);

      await expect(
        service.create(
          'board-uuid',
          'ws-uuid',
          'card-uuid',
          { content: 'Deep', parentCommentId: 'reply-1' } as any,
          'user-1',
        ),
      ).rejects.toThrow('Only one reply level is supported');
    });
  });

  describe('update without explicit content', () => {
    it('should keep existing content when dto content is omitted', async () => {
      cardRepo.findActiveById.mockResolvedValue({ id: 'card-uuid' } as any);
      commentRepo.findActiveById.mockResolvedValue({
        id: 'comm-1',
        authorId: 'user-1',
        content: 'Old text',
      } as any);
      commentRepo.update.mockResolvedValue({
        id: 'comm-1',
        content: 'Old text',
      } as any);

      const result = await service.update(
        'board-uuid',
        'ws-uuid',
        'card-uuid',
        'comm-1',
        {},
        'user-1',
      );

      expect(commentRepo.update).toHaveBeenCalledWith('comm-1', 'Old text');
      expect(result.content).toBe('Old text');
    });
  });

  describe('listThread', () => {
    it('should return parent with replies', async () => {
      cardRepo.findActiveById.mockResolvedValue({ id: 'card-uuid' } as any);
      commentRepo.findActiveById.mockResolvedValue({ id: 'parent-1' } as any);
      commentRepo.findRepliesByParentId.mockResolvedValue([
        { id: 'reply-1' },
      ] as any);

      const result = await service.listThread(
        'board-uuid',
        'ws-uuid',
        'card-uuid',
        'parent-1',
      );

      expect(result.replies).toEqual([{ id: 'reply-1' }]);
    });

    it('should throw when parent not found', async () => {
      cardRepo.findActiveById.mockResolvedValue({ id: 'card-uuid' } as any);
      commentRepo.findActiveById.mockResolvedValue(null);

      await expect(
        service.listThread('board-uuid', 'ws-uuid', 'card-uuid', 'missing'),
      ).rejects.toThrow(EntityNotFoundException);
    });
  });
});
