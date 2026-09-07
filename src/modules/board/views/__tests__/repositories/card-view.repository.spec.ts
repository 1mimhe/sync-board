import { Test, TestingModule } from '@nestjs/testing';
import { CardViewRepository } from '../../repositories/card-view.repository';
import { PrismaService } from '../../../../../common/database/prisma.service';

describe('CardViewRepository', () => {
  let repository: CardViewRepository;
  let prisma: any;

  beforeEach(async () => {
    prisma = { card: { findMany: jest.fn() } };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CardViewRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    repository = module.get<CardViewRepository>(CardViewRepository);
  });

  it('should return calendar page with and without cursor', async () => {
    prisma.card.findMany.mockResolvedValue([{ id: 'c-1' }, { id: 'c-2' }]);
    const page = await repository.calendarPage(
      'b-1',
      new Date('2026-01-01'),
      new Date('2026-01-31'),
      undefined,
      1,
    );
    expect(page.items).toHaveLength(1);
    expect(page.pagination.hasMore).toBe(true);
    prisma.card.findMany.mockResolvedValue([]);
    const empty = await repository.calendarPage(
      'b-1',
      new Date(),
      new Date(),
      'c-0',
      20,
    );
    expect(empty.items).toEqual([]);
    expect(empty.pagination.cursor).toBeNull();
  });

  it('should return timeline page', async () => {
    prisma.card.findMany.mockResolvedValue([{ id: 'c-1' }]);
    const page = await repository.timelinePage('b-1', undefined, 20);
    expect(page.items).toHaveLength(1);
  });

  it('should paginate timeline with cursor and report next page', async () => {
    prisma.card.findMany.mockResolvedValue([{ id: 'c-1' }, { id: 'c-2' }]);
    const page = await repository.timelinePage('b-1', 'c-0', 1);
    expect(page.items).toHaveLength(1);
    expect(page.pagination).toEqual({ cursor: 'c-1', hasMore: true });
    expect(prisma.card.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: 'c-0' }, skip: 1 }),
    );
  });

  it('should return null cursor for empty timeline', async () => {
    prisma.card.findMany.mockResolvedValue([]);
    const page = await repository.timelinePage('b-1', undefined, 20);
    expect(page.items).toEqual([]);
    expect(page.pagination.cursor).toBeNull();
  });

  it('should return table page with filters', async () => {
    prisma.card.findMany.mockResolvedValue([{ id: 'c-1' }, { id: 'c-2' }]);
    const page = await repository.tablePage(
      'b-1',
      { status: 'active', priority: 'high', assigneeId: 'u-1' },
      undefined,
      1,
    );
    expect(page.items).toHaveLength(1);
    expect(prisma.card.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'active' }),
      }),
    );
    prisma.card.findMany.mockResolvedValue([{ id: 'c-1' }]);
    const page2 = await repository.tablePage('b-1', {}, 'c-0', 20);
    expect(page2.pagination.hasMore).toBe(false);
  });

  it('should return null cursor for empty table page', async () => {
    prisma.card.findMany.mockResolvedValue([]);
    const page = await repository.tablePage('b-1', {}, undefined, 20);
    expect(page.items).toEqual([]);
    expect(page.pagination.cursor).toBeNull();
  });
});
