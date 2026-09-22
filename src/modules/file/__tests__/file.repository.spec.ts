import { Test, TestingModule } from '@nestjs/testing';
import { FileRepository } from '../repositories/file.repository';
import { PrismaService } from '../../../common/database/prisma.service';

describe('FileRepository', () => {
  let repository: FileRepository;
  let prisma: {
    fileAttachment: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      fileAttachment: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [FileRepository, { provide: PrismaService, useValue: prisma }],
    }).compile();
    repository = module.get(FileRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates pending rows', async () => {
    prisma.fileAttachment.create.mockResolvedValue({ id: 'f-1' });
    await repository.createPending({ id: 'f-1' } as never);
    expect(prisma.fileAttachment.create).toHaveBeenCalledWith({
      data: { id: 'f-1' },
    });
  });

  it('finds active rows excluding archived', async () => {
    prisma.fileAttachment.findFirst.mockResolvedValue({ id: 'f-1' });
    await repository.findActiveById('f-1');
    expect(prisma.fileAttachment.findFirst).toHaveBeenCalledWith({
      where: { id: 'f-1', archivedAt: null },
    });
  });

  it('confirms pending rows', async () => {
    await repository.confirm('f-1');
    expect(prisma.fileAttachment.update).toHaveBeenCalledWith({
      where: { id: 'f-1' },
      data: { status: 'completed' },
    });
  });

  it('marks stale pending rows as failed and returns the count', async () => {
    prisma.fileAttachment.updateMany.mockResolvedValue({ count: 2 });
    const cutoff = new Date();
    await expect(repository.markStalePendingAsFailed(cutoff)).resolves.toBe(2);
    expect(prisma.fileAttachment.updateMany).toHaveBeenCalledWith({
      where: { status: 'pending', createdAt: { lt: cutoff } },
      data: { status: 'failed' },
    });
  });

  it('lists entity rows newest first excluding archived', async () => {
    await repository.listForEntity('card', 'card-1');
    expect(prisma.fileAttachment.findMany).toHaveBeenCalledWith({
      where: { entityType: 'card', entityId: 'card-1', archivedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('archives rows', async () => {
    await repository.archive('f-1');
    expect(prisma.fileAttachment.update).toHaveBeenCalledWith({
      where: { id: 'f-1' },
      data: { archivedAt: expect.any(Date) },
    });
  });
});
