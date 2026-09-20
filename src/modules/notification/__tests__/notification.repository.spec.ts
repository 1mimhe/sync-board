import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import { NotificationRepository } from '../repositories/notification.repository';
import { PrismaService } from '../../../common/database/prisma.service';
import { BadRequestException } from '@nestjs/common';

describe('NotificationRepository', () => {
  let repo: NotificationRepository;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    repo = module.get(NotificationRepository);
  });

  it('createOnce returns row or null on duplicate', async () => {
    prisma.notification.createManyAndReturn.mockResolvedValue([
      { id: 'n-1' },
    ] as never);
    await expect(repo.createOnce({} as never)).resolves.toEqual({ id: 'n-1' });
    prisma.notification.createManyAndReturn.mockResolvedValue([]);
    await expect(repo.createOnce({} as never)).resolves.toBeNull();
  });

  it('rejects unknown cursors and scopes boundary to user', async () => {
    prisma.notification.findFirst.mockResolvedValue(null);
    await expect(
      repo.findPageForUser('u-1', {
        cursor: '11111111-1111-4111-8111-111111111111',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.notification.findFirst).toHaveBeenCalledWith({
      where: { id: expect.any(String), userId: 'u-1' },
    });
  });

  it('markAllRead and cleanup use correct filters', async () => {
    await repo.markAllRead('u-1');
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u-1', isRead: false },
      data: expect.objectContaining({ isRead: true }),
    });
    prisma.notification.deleteMany.mockResolvedValue({ count: 2 });
    await expect(
      repo.deleteReadOlderThan(new Date('2020-01-01')),
    ).resolves.toBe(2);
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
      where: { isRead: true, createdAt: { lt: expect.any(Date) } },
    });
  });
});
