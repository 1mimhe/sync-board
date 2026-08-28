import { Test, TestingModule } from '@nestjs/testing';
import { ChecklistRepository } from '../../repositories/checklist.repository';
import { PrismaService } from '../../../../../common/database/prisma.service';

describe('ChecklistRepository', () => {
  let repository: ChecklistRepository;
  let prisma: any;

  const mockChecklist = {
    id: 'checklist-uuid',
    cardId: 'card-uuid',
    title: 'Definition of Done',
    rank: '0|g0000:',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockItem = {
    id: 'item-uuid',
    checklistId: 'checklist-uuid',
    content: 'Code reviewed',
    isDone: false,
    rank: '0|h000zz:',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      cardChecklist: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      checklistItem: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChecklistRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repository = module.get<ChecklistRepository>(ChecklistRepository);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('createChecklist', () => {
    it('should create checklist including ordered items', async () => {
      prisma.cardChecklist.create.mockResolvedValue({
        ...mockChecklist,
        items: [],
      });

      const result = await repository.createChecklist({
        cardId: 'card-uuid',
        title: 'Definition of Done',
        rank: '0|g0000:',
      });

      expect(prisma.cardChecklist.create).toHaveBeenCalledWith({
        data: {
          cardId: 'card-uuid',
          title: 'Definition of Done',
          rank: '0|g0000:',
        },
        include: { items: { orderBy: { rank: 'asc' } } },
      });
      expect(result.items).toEqual([]);
    });
  });

  describe('findActiveChecklist', () => {
    it('should filter out checklists whose parent card is archived', async () => {
      prisma.cardChecklist.findFirst.mockResolvedValue(mockChecklist);

      const result = await repository.findActiveChecklist('checklist-uuid');

      expect(prisma.cardChecklist.findFirst).toHaveBeenCalledWith({
        where: { id: 'checklist-uuid', card: { archivedAt: null } },
        include: { items: { orderBy: { rank: 'asc' } } },
      });
      expect(result).toEqual(mockChecklist);
    });
  });

  describe('findChecklistsByCard', () => {
    it('should find checklists ordered by rank with ordered items', async () => {
      prisma.cardChecklist.findMany.mockResolvedValue([mockChecklist]);

      const result = await repository.findChecklistsByCard('card-uuid');

      expect(prisma.cardChecklist.findMany).toHaveBeenCalledWith({
        where: { cardId: 'card-uuid', card: { archivedAt: null } },
        orderBy: { rank: 'asc' },
        include: { items: { orderBy: { rank: 'asc' } } },
      });
      expect(result).toEqual([mockChecklist]);
    });
  });

  describe('updateChecklist', () => {
    it('should update and return checklist with ordered items', async () => {
      prisma.cardChecklist.update.mockResolvedValue(mockChecklist);

      const result = await repository.updateChecklist('checklist-uuid', {
        title: 'Renamed',
      });

      expect(prisma.cardChecklist.update).toHaveBeenCalledWith({
        where: { id: 'checklist-uuid' },
        data: { title: 'Renamed' },
        include: { items: { orderBy: { rank: 'asc' } } },
      });
      expect(result).toEqual(mockChecklist);
    });
  });

  describe('deleteChecklist', () => {
    it('should hard delete the checklist (items cascade)', async () => {
      prisma.cardChecklist.delete.mockResolvedValue(mockChecklist);

      await repository.deleteChecklist('checklist-uuid');

      expect(prisma.cardChecklist.delete).toHaveBeenCalledWith({
        where: { id: 'checklist-uuid' },
      });
    });
  });

  describe('createItem', () => {
    it('should create item with exact payload', async () => {
      prisma.checklistItem.create.mockResolvedValue(mockItem);

      const result = await repository.createItem({
        checklistId: 'checklist-uuid',
        content: 'Code reviewed',
        rank: '0|h000zz:',
      });

      expect(prisma.checklistItem.create).toHaveBeenCalledWith({
        data: {
          checklistId: 'checklist-uuid',
          content: 'Code reviewed',
          rank: '0|h000zz:',
        },
      });
      expect(result).toEqual(mockItem);
    });
  });

  describe('findItem', () => {
    it('should find item including its parent checklist', async () => {
      prisma.checklistItem.findUnique.mockResolvedValue({
        ...mockItem,
        checklist: mockChecklist,
      });

      const result = await repository.findItem('item-uuid');

      expect(prisma.checklistItem.findUnique).toHaveBeenCalledWith({
        where: { id: 'item-uuid' },
        include: { checklist: true },
      });
      expect(result?.checklist.id).toBe('checklist-uuid');
    });
  });

  describe('updateItem', () => {
    it('should patch only provided fields', async () => {
      prisma.checklistItem.update.mockResolvedValue({
        ...mockItem,
        isDone: true,
      });

      const result = await repository.updateItem('item-uuid', { isDone: true });

      expect(prisma.checklistItem.update).toHaveBeenCalledWith({
        where: { id: 'item-uuid' },
        data: { isDone: true },
      });
      expect(result.isDone).toBe(true);
    });
  });

  describe('deleteItem', () => {
    it('should hard delete the item', async () => {
      prisma.checklistItem.delete.mockResolvedValue(mockItem);

      await repository.deleteItem('item-uuid');

      expect(prisma.checklistItem.delete).toHaveBeenCalledWith({
        where: { id: 'item-uuid' },
      });
    });
  });
});
