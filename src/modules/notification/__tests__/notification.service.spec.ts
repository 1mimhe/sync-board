import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from '../services/notification.service';
import { NotificationRepository } from '../repositories/notification.repository';
import { RedisService } from '../../../common/redis/redis.service';
import { EntityNotFoundException } from '../../../common/exceptions/app.exception';

describe('NotificationService', () => {
  let service: NotificationService;
  let repo: {
    findPageForUser: jest.Mock;
    countUnread: jest.Mock;
    markRead: jest.Mock;
    markAllRead: jest.Mock;
  };
  let redis: {
    get: jest.Mock;
    decr: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      findPageForUser: jest.fn(),
      countUnread: jest.fn(),
      markRead: jest.fn(),
      markAllRead: jest.fn(),
    };
    redis = { get: jest.fn(), decr: jest.fn(), set: jest.fn(), del: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: NotificationRepository, useValue: repo },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();
    service = module.get(NotificationService);
  });

  it('returns Redis count on cache hit', async () => {
    redis.get.mockResolvedValue('4');
    await expect(service.getUnreadCount('u-1')).resolves.toBe(4);
    expect(repo.countUnread).not.toHaveBeenCalled();
  });

  it('falls back to DB on cache miss', async () => {
    redis.get.mockResolvedValue(null);
    repo.countUnread.mockResolvedValue(7);
    await expect(service.getUnreadCount('u-1')).resolves.toBe(7);
  });

  it('decrements counter on markRead with floor at zero', async () => {
    repo.markRead.mockResolvedValue({
      notification: { id: 'n-1', isRead: true },
      wasUnread: true,
    });
    redis.get.mockResolvedValue('2');
    await service.markRead('u-1', 'n-1');
    expect(redis.decr).toHaveBeenCalled();
  });

  it('skips decrement when already read', async () => {
    repo.markRead.mockResolvedValue({
      notification: { id: 'n-1', isRead: true },
      wasUnread: false,
    });
    await service.markRead('u-1', 'n-1');
    expect(redis.decr).not.toHaveBeenCalled();
  });

  it('throws 404 when marking others notifications', async () => {
    repo.markRead.mockResolvedValue(null);
    await expect(service.markRead('u-1', 'n-x')).rejects.toBeInstanceOf(
      EntityNotFoundException,
    );
  });

  it('clears counter on markAllRead', async () => {
    await service.markAllRead('u-1');
    expect(repo.markAllRead).toHaveBeenCalledWith('u-1');
    expect(redis.del).toHaveBeenCalled();
  });
});
