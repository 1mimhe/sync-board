import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { CardCommentService } from '../../services/card-comment.service';
import { CardCommentRepository } from '../../repositories/card-comment.repository';
import { CardRepository } from '../../repositories/card.repository';
import { BoardRepository } from '../../repositories/board.repository';
import { EntityNotFoundException } from '../../../../common/exceptions/app.exception';
import { ForbiddenException } from '@nestjs/common';

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
      expect(eventEmitter.emit).toHaveBeenCalledWith('comment.created', expect.any(Object));
    });
  });

  describe('getCardComments', () => {
    it('should return paginated comments with meta', async () => {
      const mockComment = {
        id: 'comment-uuid',
        cardId: 'card-uuid',
        authorId: 'user-uuid',
        content: 'Looking good',
        author: { id: 'user-uuid', displayName: 'John', avatarUrl: null },
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      cardRepo.findActiveById.mockResolvedValue({ id: 'card-uuid' } as any);
      commentRepo.findCardComments.mockResolvedValue([mockComment]);
      commentRepo.countByCardId.mockResolvedValue(1);

      const result = await service.getCardComments(
        'board-uuid',
        'ws-uuid',
        'card-uuid',
        {
          page: 1,
          pageSize: 20,
        },
      );

      expect(result.items).toEqual([mockComment]);
      expect(result.meta).toEqual({
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
      });
      expect(commentRepo.findCardComments).toHaveBeenCalledWith(
        'card-uuid',
        0,
        20,
      );
    });

    it('should apply default pagination when no query is provided', async () => {
      cardRepo.findActiveById.mockResolvedValue({ id: 'card-uuid' } as any);
      commentRepo.findCardComments.mockResolvedValue([]);
      commentRepo.countByCardId.mockResolvedValue(0);

      const result = await service.getCardComments(
        'board-uuid',
        'ws-uuid',
        'card-uuid',
      );

      expect(commentRepo.findCardComments).toHaveBeenCalledWith(
        'card-uuid',
        0,
        50,
      );
      expect(result.meta).toEqual({
        page: 1,
        pageSize: 50,
        total: 0,
        totalPages: 1,
      });
    });

    it('should throw EntityNotFoundException when card does not exist', async () => {
      cardRepo.findActiveById.mockResolvedValue(null);

      await expect(
        service.getCardComments(
          'board-uuid',
          'ws-uuid',
          'nonexistent-uuid',
        ),
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
      commentRepo.softDelete.mockResolvedValue(undefined as any);

      await service.delete(
        'board-uuid',
        'ws-uuid',
        'card-uuid',
        'comm-1',
        'user-1',
      );

      expect(commentRepo.softDelete).toHaveBeenCalledWith('comm-1');
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
});
