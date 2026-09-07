import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { CardRepository } from '../../repositories/card.repository';
import { PrismaService } from '../../../../../common/database/prisma.service';
import { EntityNotFoundException } from '../../../../../common/exceptions/app.exception';

describe('CardRepository', () => {
  let repository: CardRepository;
  let prismaService: any;
  let txMock: any;

  beforeEach(async () => {
    txMock = {
      card: {
        create: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      cardAssignee: {
        createMany: jest.fn(),
      },
      cardLabel: {
        createMany: jest.fn(),
      },
    };

    prismaService = {
      $transaction: jest.fn((cb) => cb(txMock)),
      card: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      cardAssignee: {
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
      cardLabel: {
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CardRepository,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    repository = module.get<CardRepository>(CardRepository);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('create', () => {
    it('should create card with initial assignees and labels in transaction', async () => {
      const mockCreated = { id: 'c-1', title: 'Task' };
      const mockResult = {
        id: 'c-1',
        title: 'Task',
        assignees: [],
        labels: [],
        attachments: [],
      };

      txMock.card.create.mockResolvedValue(mockCreated);
      txMock.card.findUniqueOrThrow.mockResolvedValue(mockResult);

      const result = await repository.create(
        { title: 'Task', listId: 'l-1', rank: '0|h:', createdBy: 'u-1' },
        ['u-1', 'u-2'],
        ['lbl-1'],
      );

      expect(txMock.card.create).toHaveBeenCalledWith({
        data: { title: 'Task', listId: 'l-1', rank: '0|h:', createdBy: 'u-1' },
      });
      expect(txMock.cardAssignee.createMany).toHaveBeenCalledWith({
        data: [
          { cardId: 'c-1', userId: 'u-1' },
          { cardId: 'c-1', userId: 'u-2' },
        ],
        skipDuplicates: true,
      });
      expect(txMock.cardLabel.createMany).toHaveBeenCalledWith({
        data: [{ cardId: 'c-1', labelId: 'lbl-1' }],
        skipDuplicates: true,
      });
      expect(result).toEqual(mockResult);
    });

    it('should create card without assignees and labels when arrays are empty or omitted', async () => {
      const mockCreated = { id: 'c-1' };
      const mockResult = { id: 'c-1', assignees: [], labels: [] };

      txMock.card.create.mockResolvedValue(mockCreated);
      txMock.card.findUniqueOrThrow.mockResolvedValue(mockResult);

      const result = await repository.create({
        title: 'Task',
        listId: 'l-1',
        rank: '0|h:',
        createdBy: 'u-1',
      });

      expect(txMock.cardAssignee.createMany).not.toHaveBeenCalled();
      expect(txMock.cardLabel.createMany).not.toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });
  });

  describe('findActiveById and findByIdIncludingArchived', () => {
    it('should find active card by id with board filter', async () => {
      const mockCard = { id: 'c-1', title: 'Task' };
      prismaService.card.findFirst.mockResolvedValue(mockCard);

      const result = await repository.findActiveById('c-1', 'b-1');

      expect(prismaService.card.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'c-1',
          archivedAt: null,
          deletedAt: null,
          list: { boardId: 'b-1' },
        },
        include: expect.any(Object),
      });
      expect(result).toEqual(mockCard);
    });

    it('should find card including archived', async () => {
      const mockCard = { id: 'c-1', archivedAt: new Date() };
      prismaService.card.findFirst.mockResolvedValue(mockCard);

      const result = await repository.findByIdIncludingArchived('c-1');

      expect(prismaService.card.findFirst).toHaveBeenCalledWith({
        where: { id: 'c-1' },
      });
      expect(result).toEqual(mockCard);
    });
  });

  describe('findLastInList', () => {
    it('should find last card in list ordered by rank desc', async () => {
      const lastCard = { id: 'c-last', rank: '0|z:' };
      prismaService.card.findFirst.mockResolvedValue(lastCard);

      const result = await repository.findLastInList('l-1');

      expect(prismaService.card.findFirst).toHaveBeenCalledWith({
        where: { listId: 'l-1', archivedAt: null, deletedAt: null },
        orderBy: { rank: 'desc' },
      });
      expect(result).toEqual(lastCard);
    });
  });

  describe('update and moveCard', () => {
    it('should update card fields', async () => {
      const updated = { id: 'c-1', title: 'New Title' };
      prismaService.card.update.mockResolvedValue(updated);

      const result = await repository.update('c-1', { title: 'New Title' });

      expect(prismaService.card.update).toHaveBeenCalledWith({
        where: { id: 'c-1' },
        data: { title: 'New Title' },
      });
      expect(result).toEqual(updated);
    });

    it('should move card to new list with new rank', async () => {
      const moved = { id: 'c-1', listId: 'l-2', rank: '0|i:' };
      prismaService.card.update.mockResolvedValue(moved);

      const result = await repository.moveCard('c-1', 'l-2', '0|i:');

      expect(prismaService.card.update).toHaveBeenCalledWith({
        where: { id: 'c-1' },
        data: { listId: 'l-2', rank: '0|i:' },
      });
      expect(result).toEqual(moved);
    });
  });

  describe('archive and unarchive', () => {
    it('should archive card', async () => {
      const archived = { id: 'c-1', archivedAt: expect.any(Date) };
      prismaService.card.update.mockResolvedValue(archived);

      const result = await repository.archive('c-1');

      expect(prismaService.card.update).toHaveBeenCalledWith({
        where: { id: 'c-1' },
        data: { archivedAt: expect.any(Date) },
      });
      expect(result).toEqual(archived);
    });

    it('should unarchive card', async () => {
      const unarchived = { id: 'c-1', archivedAt: null };
      prismaService.card.update.mockResolvedValue(unarchived);

      const result = await repository.unarchive('c-1');

      expect(prismaService.card.update).toHaveBeenCalledWith({
        where: { id: 'c-1' },
        data: { archivedAt: null },
      });
      expect(result).toEqual(unarchived);
    });
  });

  describe('assignees', () => {
    it('should upsert card assignee', async () => {
      prismaService.cardAssignee.upsert.mockResolvedValue({});

      await repository.addAssignee('c-1', 'u-1');

      expect(prismaService.cardAssignee.upsert).toHaveBeenCalledWith({
        where: { cardId_userId: { cardId: 'c-1', userId: 'u-1' } },
        create: { cardId: 'c-1', userId: 'u-1' },
        update: {},
      });
    });

    it('should delete card assignee', async () => {
      prismaService.cardAssignee.deleteMany.mockResolvedValue({ count: 1 });

      await repository.removeAssignee('c-1', 'u-1');

      expect(prismaService.cardAssignee.deleteMany).toHaveBeenCalledWith({
        where: { cardId: 'c-1', userId: 'u-1' },
      });
    });
  });

  describe('labels', () => {
    it('should upsert card label', async () => {
      prismaService.cardLabel.upsert.mockResolvedValue({});

      await repository.addLabel('c-1', 'lbl-1');

      expect(prismaService.cardLabel.upsert).toHaveBeenCalledWith({
        where: { cardId_labelId: { cardId: 'c-1', labelId: 'lbl-1' } },
        create: { cardId: 'c-1', labelId: 'lbl-1' },
        update: {},
      });
    });

    it('should delete card label', async () => {
      prismaService.cardLabel.deleteMany.mockResolvedValue({ count: 1 });

      await repository.removeLabel('c-1', 'lbl-1');

      expect(prismaService.cardLabel.deleteMany).toHaveBeenCalledWith({
        where: { cardId: 'c-1', labelId: 'lbl-1' },
      });
    });
  });

  describe('findArchivedByBoardIdPage', () => {
    it('should return paginated archived cards with cursor', async () => {
      prismaService.card.findMany = jest
        .fn()
        .mockResolvedValue([{ id: 'c-1' }, { id: 'c-2' }]);

      const result = await repository.findArchivedByBoardIdPage(
        'b-1',
        'cursor-0',
        1,
      );

      expect(result.items).toHaveLength(1);
      expect(result.pagination).toEqual({ cursor: 'c-1', hasMore: true });
      expect(prismaService.card.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 2,
          cursor: { id: 'cursor-0' },
          skip: 1,
        }),
      );
    });

    it('should return last page without cursor', async () => {
      prismaService.card.findMany = jest
        .fn()
        .mockResolvedValue([{ id: 'c-1' }]);

      const result = await repository.findArchivedByBoardIdPage(
        'b-1',
        undefined,
        20,
      );

      expect(result.items).toHaveLength(1);
      expect(result.pagination.hasMore).toBe(false);
    });
  });

  describe('findByIdIncludingDeleted', () => {
    it('should scope by board when provided', async () => {
      prismaService.card.findFirst.mockResolvedValue({ id: 'c-1' });

      await expect(
        repository.findByIdIncludingDeleted('c-1', 'b-1'),
      ).resolves.toEqual({ id: 'c-1' });
      expect(prismaService.card.findFirst).toHaveBeenCalledWith({
        where: { id: 'c-1', list: { boardId: 'b-1' } },
      });
    });

    it('should omit board scope when not provided', async () => {
      prismaService.card.findFirst.mockResolvedValue(null);

      await expect(
        repository.findByIdIncludingDeleted('c-x'),
      ).resolves.toBeNull();
    });
  });

  describe('deletePermanently', () => {
    it('should set deletedAt', async () => {
      prismaService.card.update.mockResolvedValue({ id: 'c-1' });

      await expect(repository.deletePermanently('c-1')).resolves.toEqual({
        id: 'c-1',
      });
    });
  });

  describe('updatePriority', () => {
    it('should update priority', async () => {
      prismaService.card.update.mockResolvedValue({
        id: 'c-1',
        priority: 'high',
      });

      await expect(
        repository.updatePriority('c-1', 'high' as any),
      ).resolves.toEqual({
        id: 'c-1',
        priority: 'high',
      });
    });

    it('should map P2025 to EntityNotFoundException', async () => {
      prismaService.card.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('missing', {
          code: 'P2025',
          clientVersion: 'x',
        }),
      );

      await expect(
        repository.updatePriority('c-x', 'high' as any),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });

    it('should rethrow unknown errors', async () => {
      prismaService.card.update.mockRejectedValue(new Error('boom'));

      await expect(
        repository.updatePriority('c-1', 'high' as any),
      ).rejects.toThrow('boom');
    });
  });

  describe('updateStatus', () => {
    it('should update status with derived isComplete', async () => {
      prismaService.card.update.mockResolvedValue({
        id: 'c-1',
        status: 'done',
      });

      await expect(
        repository.updateStatus('c-1', 'done' as any, true),
      ).resolves.toEqual({
        id: 'c-1',
        status: 'done',
      });
    });

    it('should map P2025 to EntityNotFoundException', async () => {
      prismaService.card.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('missing', {
          code: 'P2025',
          clientVersion: 'x',
        }),
      );

      await expect(
        repository.updateStatus('c-x', 'done' as any, true),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });

    it('should rethrow unknown errors', async () => {
      prismaService.card.update.mockRejectedValue(new Error('boom'));

      await expect(
        repository.updateStatus('c-1', 'done' as any, true),
      ).rejects.toThrow('boom');
    });
  });

  describe('subcards', () => {
    it('should find active subcards ordered by rank', async () => {
      prismaService.card.findMany = jest
        .fn()
        .mockResolvedValue([{ id: 'c-sub' }]);

      await expect(repository.findSubcards('p-1')).resolves.toEqual([
        { id: 'c-sub' },
      ]);
    });

    it('should attach subcard', async () => {
      prismaService.card.update.mockResolvedValue({ id: 'c-1' });

      await expect(repository.attachSubcard('c-1', 'p-1')).resolves.toEqual({
        id: 'c-1',
      });
      expect(prismaService.card.update).toHaveBeenCalledWith({
        where: { id: 'c-1' },
        data: { parentCardId: 'p-1' },
      });
    });

    it('should detach subcard', async () => {
      prismaService.card.update.mockResolvedValue({ id: 'c-1' });

      await expect(repository.detachSubcard('c-1')).resolves.toEqual({
        id: 'c-1',
      });
      expect(prismaService.card.update).toHaveBeenCalledWith({
        where: { id: 'c-1' },
        data: { parentCardId: null },
      });
    });

    it('should count subcards', async () => {
      prismaService.card.count = jest.fn().mockResolvedValue(3);

      await expect(repository.countSubcards('p-1')).resolves.toBe(3);
    });
  });
});
