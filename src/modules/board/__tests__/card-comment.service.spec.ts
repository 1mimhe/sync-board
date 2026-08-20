import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { CardCommentService } from '../services/card-comment.service';
import { CardCommentRepository } from '../repositories/card-comment.repository';
import { CardRepository } from '../repositories/card.repository';
import { BoardRepository } from '../repositories/board.repository';
import { EntityNotFoundException } from '../../../common/exceptions/app.exception';

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

  it('should be defined', () => {
    expect(service).toBeDefined();
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
});
