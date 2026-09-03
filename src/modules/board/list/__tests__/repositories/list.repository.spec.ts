import { Test, TestingModule } from '@nestjs/testing';
import { ListRepository } from '../../repositories/list.repository';
import { PrismaService } from '../../../../../common/database/prisma.service';

describe('ListRepository', () => {
  let repository: ListRepository;
  let prismaService: any;

  beforeEach(async () => {
    prismaService = {
      list: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListRepository,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    repository = module.get<ListRepository>(ListRepository);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('create', () => {
    it('should create a list record', async () => {
      const mockList = {
        id: 'l-1',
        title: 'To Do',
        boardId: 'b-1',
        rank: '0|hzzzzz:',
      };
      prismaService.list.create.mockResolvedValue(mockList);

      const result = await repository.create({
        title: 'To Do',
        boardId: 'b-1',
        rank: '0|hzzzzz:',
      });

      expect(prismaService.list.create).toHaveBeenCalledWith({
        data: { title: 'To Do', boardId: 'b-1', rank: '0|hzzzzz:' },
      });
      expect(result).toEqual(mockList);
    });
  });

  describe('findActiveById and findByIdIncludingArchived', () => {
    it('should find active list by id with optional boardId filter', async () => {
      const mockList = { id: 'l-1', title: 'To Do' };
      prismaService.list.findFirst.mockResolvedValue(mockList);

      const result = await repository.findActiveById('l-1', 'b-1');

      expect(prismaService.list.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'l-1',
          archivedAt: null,
          deletedAt: null,
          boardId: 'b-1',
        },
      });
      expect(result).toEqual(mockList);
    });

    it('should find list including archived', async () => {
      const mockList = { id: 'l-1', archivedAt: new Date() };
      prismaService.list.findFirst.mockResolvedValue(mockList);

      const result = await repository.findByIdIncludingArchived('l-1');

      expect(prismaService.list.findFirst).toHaveBeenCalledWith({
        where: { id: 'l-1' },
      });
      expect(result).toEqual(mockList);
    });
  });

  describe('findLastInBoard and findBoardLists', () => {
    it('should find the last active list in a board (highest rank)', async () => {
      const lastList = { id: 'l-3', rank: '0|z:' };
      prismaService.list.findFirst.mockResolvedValue(lastList);

      const result = await repository.findLastInBoard('b-1');

      expect(prismaService.list.findFirst).toHaveBeenCalledWith({
        where: { boardId: 'b-1', archivedAt: null, deletedAt: null },
        orderBy: { rank: 'desc' },
      });
      expect(result).toEqual(lastList);
    });

    it('should find all active lists in a board ordered by rank', async () => {
      const lists = [
        { id: 'l-1', rank: '0|a:' },
        { id: 'l-2', rank: '0|b:' },
      ];
      prismaService.list.findMany.mockResolvedValue(lists);

      const result = await repository.findBoardLists('b-1');

      expect(prismaService.list.findMany).toHaveBeenCalledWith({
        where: { boardId: 'b-1', archivedAt: null, deletedAt: null },
        orderBy: { rank: 'asc' },
      });
      expect(result).toEqual(lists);
    });
  });

  describe('update, archive, and unarchive', () => {
    it('should update list fields', async () => {
      const updatedList = { id: 'l-1', title: 'Done' };
      prismaService.list.update.mockResolvedValue(updatedList);

      const result = await repository.update('l-1', { title: 'Done' });

      expect(prismaService.list.update).toHaveBeenCalledWith({
        where: { id: 'l-1' },
        data: { title: 'Done' },
      });
      expect(result).toEqual(updatedList);
    });

    it('should archive list by setting archivedAt', async () => {
      const archivedList = { id: 'l-1', archivedAt: expect.any(Date) };
      prismaService.list.update.mockResolvedValue(archivedList);

      const result = await repository.archive('l-1');

      expect(prismaService.list.update).toHaveBeenCalledWith({
        where: { id: 'l-1' },
        data: { archivedAt: expect.any(Date) },
      });
      expect(result).toEqual(archivedList);
    });

    it('should unarchive list by clearing archivedAt', async () => {
      const unarchivedList = { id: 'l-1', archivedAt: null };
      prismaService.list.update.mockResolvedValue(unarchivedList);

      const result = await repository.unarchive('l-1');

      expect(prismaService.list.update).toHaveBeenCalledWith({
        where: { id: 'l-1' },
        data: { archivedAt: null },
      });
      expect(result).toEqual(unarchivedList);
    });
  });
});
