import { CardCommentController } from '../../controllers/comment.controller';
import { CardCommentService } from '../../services/card-comment.service';
import type { JwtPayload } from '../../../auth/interfaces/jwt-payload.interface';

describe('CardCommentController', () => {
  let controller: CardCommentController;
  let commentService: jest.Mocked<CardCommentService>;

  const mockUser: JwtPayload = {
    sub: 'user-uuid-1',
    email: 'user@test.com',
    jti: 'jti-1',
  };

  const mockComment = {
    id: 'comm-1',
    cardId: 'card-1',
    authorId: 'user-uuid-1',
    content: 'Great progress on this!',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    author: {
      id: 'user-uuid-1',
      displayName: 'User',
      avatarUrl: null,
    },
  };

  beforeEach(() => {
    commentService = {
      create: jest.fn(),
      getCardComments: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<CardCommentService>;

    controller = new CardCommentController(commentService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('create', () => {
    it('should create comment and return mapped DTO', async () => {
      commentService.create.mockResolvedValue(mockComment as any);

      const result = await controller.create(
        'ws-1',
        'board-1',
        'card-1',
        { content: 'Great progress on this!' },
        mockUser,
      );

      expect(commentService.create).toHaveBeenCalledWith(
        'board-1',
        'ws-1',
        'card-1',
        { content: 'Great progress on this!' },
        'user-uuid-1',
      );
      expect(result.id).toBe('comm-1');
      expect(result.content).toBe('Great progress on this!');
    });
  });

  describe('list', () => {
    it('should pass parsed cursor query through and return { items, pagination }', async () => {
      const mockResult = {
        items: [mockComment],
        pagination: { cursor: 'comm-1', hasMore: false },
      };
      commentService.getCardComments.mockResolvedValue(mockResult as any);

      const result = await controller.list(
        'ws-1',
        'board-1',
        'card-1',
        { cursor: 'cursor-uuid', limit: 20 },
      );

      expect(commentService.getCardComments).toHaveBeenCalledWith(
        'board-1',
        'ws-1',
        'card-1',
        { cursor: 'cursor-uuid', limit: 20 },
      );
      expect(result.items).toHaveLength(1);
      expect(result.pagination).toEqual({ cursor: 'comm-1', hasMore: false });
    });
  });

  describe('update', () => {
    it('should update comment text', async () => {
      commentService.update.mockResolvedValue({ ...mockComment, content: 'Updated comment' } as any);

      const result = await controller.update(
        'ws-1',
        'board-1',
        'card-1',
        'comm-1',
        { content: 'Updated comment' },
        mockUser,
      );

      expect(commentService.update).toHaveBeenCalledWith(
        'board-1',
        'ws-1',
        'card-1',
        'comm-1',
        { content: 'Updated comment' },
        'user-uuid-1',
      );
      expect(result.content).toBe('Updated comment');
    });
  });

  describe('delete', () => {
    it('should soft delete comment', async () => {
      commentService.delete.mockResolvedValue(undefined as any);

      await controller.delete('ws-1', 'board-1', 'card-1', 'comm-1', mockUser);

      expect(commentService.delete).toHaveBeenCalledWith(
        'board-1',
        'ws-1',
        'card-1',
        'comm-1',
        'user-uuid-1',
      );
    });
  });
});
