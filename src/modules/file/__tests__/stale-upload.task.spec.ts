import { Test, TestingModule } from '@nestjs/testing';
import { StaleUploadTask } from '../tasks/stale-upload.task';
import { FileRepository } from '../repositories/file.repository';

describe('StaleUploadTask', () => {
  let task: StaleUploadTask;
  let fileRepo: { markStalePendingAsFailed: jest.Mock };

  beforeEach(async () => {
    fileRepo = { markStalePendingAsFailed: jest.fn().mockResolvedValue(3) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaleUploadTask,
        { provide: FileRepository, useValue: fileRepo },
      ],
    }).compile();
    task = module.get(StaleUploadTask);
  });

  it('marks pending uploads older than 24h as failed', async () => {
    await task.markStaleUploadsFailed();

    expect(fileRepo.markStalePendingAsFailed).toHaveBeenCalledTimes(1);
    const cutoff: Date = fileRepo.markStalePendingAsFailed.mock.calls[0][0];
    const ageHours = (Date.now() - cutoff.getTime()) / (60 * 60 * 1000);
    expect(ageHours).toBeGreaterThan(23);
    expect(ageHours).toBeLessThan(25);
  });
});
