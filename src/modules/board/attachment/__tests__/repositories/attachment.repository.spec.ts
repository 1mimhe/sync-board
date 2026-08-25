import { Test, TestingModule } from '@nestjs/testing';
import { CardAttachmentRepository } from '../../repositories/attachment.repository';
import { PrismaService } from '../../../../../common/database/prisma.service';

describe('CardAttachmentRepository', () => {
  let repository: CardAttachmentRepository;
  let prismaService: any;

  beforeEach(async () => {
    prismaService = {
      cardAttachment: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CardAttachmentRepository,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    repository = module.get<CardAttachmentRepository>(CardAttachmentRepository);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('create', () => {
    it('should create attachment and return with uploadedBy relation', async () => {
      const mockResult = { id: 'att-1', name: 'test.png', uploadedBy: { id: 'u-1', displayName: 'User', avatarUrl: null } };
      prismaService.cardAttachment.create.mockResolvedValue(mockResult);

      const result = await repository.create({
        cardId: 'c-1',
        name: 'test.png',
        url: 'https://example.com/test.png',
        type: 'image' as any,
        uploadedById: 'u-1',
      });

      expect(prismaService.cardAttachment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: 'test.png', cardId: 'c-1' }),
        include: { uploadedBy: { select: expect.any(Object) } },
      });
      expect(result).toEqual(mockResult);
    });
  });

  describe('findById and findByCardId', () => {
    it('should find active attachment by id', async () => {
      const mockResult = { id: 'att-1', name: 'file.pdf' };
      prismaService.cardAttachment.findFirst.mockResolvedValue(mockResult);

      const result = await repository.findById('att-1');

      expect(prismaService.cardAttachment.findFirst).toHaveBeenCalledWith({
        where: { id: 'att-1', archivedAt: null },
        include: { uploadedBy: { select: expect.any(Object) } },
      });
      expect(result).toEqual(mockResult);
    });

    it('should find all active attachments for card ordered newest first', async () => {
      const mockList = [{ id: 'att-1' }, { id: 'att-2' }];
      prismaService.cardAttachment.findMany.mockResolvedValue(mockList);

      const result = await repository.findByCardId('c-1');

      expect(prismaService.cardAttachment.findMany).toHaveBeenCalledWith({
        where: { cardId: 'c-1', archivedAt: null },
        include: { uploadedBy: { select: expect.any(Object) } },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(mockList);
    });
  });

  describe('update, archive, and delete', () => {
    it('should update attachment metadata', async () => {
      const mockUpdated = { id: 'att-1', name: 'renamed.png' };
      prismaService.cardAttachment.update.mockResolvedValue(mockUpdated);

      const result = await repository.update('att-1', { name: 'renamed.png' });

      expect(prismaService.cardAttachment.update).toHaveBeenCalledWith({
        where: { id: 'att-1' },
        data: { name: 'renamed.png' },
        include: { uploadedBy: { select: expect.any(Object) } },
      });
      expect(result).toEqual(mockUpdated);
    });

    it('should archive attachment by setting archivedAt', async () => {
      const mockArchived = { id: 'att-1', archivedAt: expect.any(Date) };
      prismaService.cardAttachment.update.mockResolvedValue(mockArchived);

      const result = await repository.archive('att-1');

      expect(prismaService.cardAttachment.update).toHaveBeenCalledWith({
        where: { id: 'att-1' },
        data: { archivedAt: expect.any(Date) },
        include: { uploadedBy: { select: expect.any(Object) } },
      });
      expect(result).toEqual(mockArchived);
    });

    it('should delete attachment permanently', async () => {
      prismaService.cardAttachment.delete.mockResolvedValue({ id: 'att-1' });

      const result = await repository.delete('att-1');

      expect(prismaService.cardAttachment.delete).toHaveBeenCalledWith({
        where: { id: 'att-1' },
      });
      expect(result).toEqual({ id: 'att-1' });
    });
  });
});
