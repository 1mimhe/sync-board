import { Test, TestingModule } from '@nestjs/testing';
import { ActivityPartitionTask } from '../../tasks/activity-partition.task';
import { ActivityRepository } from '../../repositories/activity.repository';

describe('ActivityPartitionTask', () => {
  it('delegates to repository', async () => {
    const repo = { ensurePartitions: jest.fn().mockResolvedValue(undefined) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityPartitionTask,
        { provide: ActivityRepository, useValue: repo },
      ],
    }).compile();
    await module.get(ActivityPartitionTask).ensurePartitions();
    expect(repo.ensurePartitions).toHaveBeenCalled();
  });

  it('logs and resolves on failure', async () => {
    const repo = {
      ensurePartitions: jest.fn().mockRejectedValue(new Error('db down')),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityPartitionTask,
        { provide: ActivityRepository, useValue: repo },
      ],
    }).compile();
    await expect(
      module.get(ActivityPartitionTask).ensurePartitions(),
    ).resolves.not.toThrow();
  });
});
