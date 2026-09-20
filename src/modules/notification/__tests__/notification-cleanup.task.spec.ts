import { Test, TestingModule } from '@nestjs/testing';
import { NotificationCleanupTask } from '../tasks/notification-cleanup.task';
import { NotificationRepository } from '../repositories/notification.repository';

describe('NotificationCleanupTask', () => {
  it('purges read notifications older than 90 days', async () => {
    const repo = { deleteReadOlderThan: jest.fn().mockResolvedValue(5) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationCleanupTask,
        { provide: NotificationRepository, useValue: repo },
      ],
    }).compile();
    await module.get(NotificationCleanupTask).purgeOldRead();
    expect(repo.deleteReadOlderThan).toHaveBeenCalledWith(expect.any(Date));
  });

  it('swallows errors', async () => {
    const repo = {
      deleteReadOlderThan: jest.fn().mockRejectedValue(new Error('db down')),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationCleanupTask,
        { provide: NotificationRepository, useValue: repo },
      ],
    }).compile();
    await expect(
      module.get(NotificationCleanupTask).purgeOldRead(),
    ).resolves.not.toThrow();
  });
});
