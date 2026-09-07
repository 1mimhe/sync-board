import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { CardTimeRepository } from '../../repositories/card-time.repository';
import { PrismaService } from '../../../../../common/database/prisma.service';
import { EntityNotFoundException } from '../../../../../common/exceptions/app.exception';

describe('CardTimeRepository', () => {
  let repository: CardTimeRepository;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(),
      cardTimeEntry: { findMany: jest.fn(), aggregate: jest.fn() },
      card: { update: jest.fn() },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CardTimeRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    repository = module.get<CardTimeRepository>(CardTimeRepository);
  });

  it('should add entry in transaction', async () => {
    prisma.$transaction.mockImplementation(async (fn: any) =>
      fn({
        cardTimeEntry: { create: jest.fn().mockResolvedValue({ id: 'e-1' }) },
        card: { update: jest.fn() },
      }),
    );
    const result = await repository.addEntry({
      cardId: 'c-1',
      userId: 'u-1',
      minutes: 30,
    });
    expect(result).toEqual({ id: 'e-1' });
  });

  it('should map P2003 to not-found on addEntry', async () => {
    prisma.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('x', {
        code: 'P2003',
        clientVersion: 'x',
      }),
    );
    await expect(
      repository.addEntry({ cardId: 'c-x' } as any),
    ).rejects.toBeInstanceOf(EntityNotFoundException);
  });

  it('should map P2025 to not-found on addEntry', async () => {
    prisma.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('x', {
        code: 'P2025',
        clientVersion: 'x',
      }),
    );
    await expect(
      repository.addEntry({ cardId: 'c-x' } as any),
    ).rejects.toBeInstanceOf(EntityNotFoundException);
  });

  it('should rethrow unknown addEntry errors', async () => {
    prisma.$transaction.mockRejectedValue(new Error('boom'));
    await expect(repository.addEntry({} as any)).rejects.toThrow('boom');
  });

  it('should paginate entries with and without cursor', async () => {
    prisma.cardTimeEntry.findMany.mockResolvedValue([
      { id: 'e-1' },
      { id: 'e-2' },
    ]);
    const page = await repository.listForCard('c-1', undefined, 1);
    expect(page.items).toHaveLength(1);
    expect(page.pagination.hasMore).toBe(true);
    prisma.cardTimeEntry.findMany.mockResolvedValue([{ id: 'e-1' }]);
    const page2 = await repository.listForCard('c-1', 'e-0', 20);
    expect(page2.pagination.hasMore).toBe(false);
  });

  it('should return null cursor for empty entries', async () => {
    prisma.cardTimeEntry.findMany.mockResolvedValue([]);
    const page = await repository.listForCard('c-1', undefined, 20);
    expect(page.items).toEqual([]);
    expect(page.pagination.cursor).toBeNull();
  });

  it('should sum minutes', async () => {
    prisma.cardTimeEntry.aggregate.mockResolvedValue({ _sum: { minutes: 45 } });
    await expect(repository.sumForCard('c-1')).resolves.toBe(45);
    prisma.cardTimeEntry.aggregate.mockResolvedValue({
      _sum: { minutes: null },
    });
    await expect(repository.sumForCard('c-1')).resolves.toBe(0);
  });
});
