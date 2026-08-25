import { Test, TestingModule } from '@nestjs/testing';
import { CardRepository } from '../../repositories/card.repository';
import { PrismaService } from '../../../../../common/database/prisma.service';

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
      const mockResult = { id: 'c-1', title: 'Task', assignees: [], labels: [], attachments: [] };

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

      const result = await repository.create({ title: 'Task', listId: 'l-1', rank: '0|h:', createdBy: 'u-1' });

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
        where: { id: 'c-1', archivedAt: null, list: { boardId: 'b-1' } },
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
        where: { listId: 'l-1', archivedAt: null },
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
});
