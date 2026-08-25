import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { CardCommentRepository } from '../../repositories/card-comment.repository';
import { PrismaService } from '../../../../common/database/prisma.service';

describe('CardCommentRepository', () => {
  let repository: CardCommentRepository;
  let prismaService: any;

  beforeEach(async () => {
    prismaService = {
      cardComment: {
        create: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CardCommentRepository,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    repository = module.get<CardCommentRepository>(CardCommentRepository);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('create', () => {
    it('should create comment and return with author relation', async () => {
      const mockCreated = { id: 'comm-1', content: 'hello' };
      const mockResult = { id: 'comm-1', content: 'hello', author: { id: 'u-1', displayName: 'User', avatarUrl: null } };

      prismaService.cardComment.create.mockResolvedValue(mockCreated);
      prismaService.cardComment.findUniqueOrThrow.mockResolvedValue(mockResult);

      const result = await repository.create({ cardId: 'c-1', authorId: 'u-1', content: 'hello' });

      expect(prismaService.cardComment.create).toHaveBeenCalledWith({
        data: { cardId: 'c-1', authorId: 'u-1', content: 'hello' },
      });
      expect(prismaService.cardComment.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: 'comm-1' },
        include: { author: { select: expect.any(Object) } },
      });
      expect(result).toEqual(mockResult);
    });
  });

  describe('findActiveById', () => {
    it('should find active non-deleted comment by id and optional cardId', async () => {
      const mockResult = { id: 'comm-1', content: 'hello' };
      prismaService.cardComment.findFirst.mockResolvedValue(mockResult);

      const result = await repository.findActiveById('comm-1', 'c-1');

      expect(prismaService.cardComment.findFirst).toHaveBeenCalledWith({
        where: { id: 'comm-1', deletedAt: null, cardId: 'c-1' },
        include: { author: { select: expect.any(Object) } },
      });
      expect(result).toEqual(mockResult);
    });
  });

  describe('findCardCommentsPage', () => {
    it('should fetch first page without cursor/skip and take limit + 1', async () => {
      const mockComments = [{ id: 'comm-1', content: 'comment 1' }];
      prismaService.cardComment.findMany.mockResolvedValue(mockComments);

      const result = await repository.findCardCommentsPage('c-1', undefined, 20);

      expect(prismaService.cardComment.findMany).toHaveBeenCalledWith({
        where: { cardId: 'c-1', deletedAt: null },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 21,
        include: { author: { select: expect.any(Object) } },
      });
      expect(result).toEqual(mockComments);
    });

    it('should include cursor and skip 1 when a cursor is provided', async () => {
      prismaService.cardComment.findMany.mockResolvedValue([]);

      await repository.findCardCommentsPage('c-1', 'cursor-uuid', 10);

      expect(prismaService.cardComment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 11,
          cursor: { id: 'cursor-uuid' },
          skip: 1,
        }),
      );
    });

    it('should retry without cursor when the cursor row is unknown (P2025)', async () => {
      const p2025 = new Prisma.PrismaClientKnownRequestError('P2025', {
        code: 'P2025',
        clientVersion: '7.0.0',
      });
      const fallbackRows = [{ id: 'comm-0', content: 'newest' }];
      prismaService.cardComment.findMany
        .mockRejectedValueOnce(p2025)
        .mockResolvedValueOnce(fallbackRows);

      const result = await repository.findCardCommentsPage(
        'c-1',
        'stale-cursor-uuid',
        20,
      );

      expect(prismaService.cardComment.findMany).toHaveBeenCalledTimes(2);
      expect(prismaService.cardComment.findMany).toHaveBeenLastCalledWith(
        expect.not.objectContaining({ cursor: expect.anything() }),
      );
      expect(result).toEqual(fallbackRows);
    });

    it('should rethrow non-P2025 errors', async () => {
      prismaService.cardComment.findMany.mockRejectedValue(
        new Error('connection lost'),
      );

      await expect(
        repository.findCardCommentsPage('c-1', undefined, 20),
      ).rejects.toThrow('connection lost');
    });
  });

  describe('update and softDelete', () => {
    it('should update comment text and return with author', async () => {
      const mockResult = { id: 'comm-1', content: 'updated', author: { id: 'u-1' } };
      prismaService.cardComment.update.mockResolvedValue({ id: 'comm-1' });
      prismaService.cardComment.findUniqueOrThrow.mockResolvedValue(mockResult);

      const result = await repository.update('comm-1', 'updated');

      expect(prismaService.cardComment.update).toHaveBeenCalledWith({
        where: { id: 'comm-1' },
        data: { content: 'updated' },
      });
      expect(result).toEqual(mockResult);
    });

    it('should soft delete comment by setting deletedAt', async () => {
      prismaService.cardComment.update.mockResolvedValue({ id: 'comm-1' });

      await repository.softDelete('comm-1');

      expect(prismaService.cardComment.update).toHaveBeenCalledWith({
        where: { id: 'comm-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });
});
