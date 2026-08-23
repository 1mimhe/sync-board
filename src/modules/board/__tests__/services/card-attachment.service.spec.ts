import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { CardAttachmentService } from '../../services/card-attachment.service';
import { CardRepository } from '../../repositories/card.repository';
import { BoardRepository } from '../../repositories/board.repository';
import { CardAttachmentRepository } from '../../repositories/card-attachment.repository';
import { EntityNotFoundException } from '../../../../common/exceptions/app.exception';
import { AttachmentType } from '@prisma/client';

describe('CardAttachmentService', () => {
  let service: CardAttachmentService;
  let cardRepo: DeepMockProxy<CardRepository>;
  let boardRepo: DeepMockProxy<BoardRepository>;
  let attachmentRepo: DeepMockProxy<CardAttachmentRepository>;
  let eventEmitter: DeepMockProxy<EventEmitter2>;

  beforeEach(async () => {
    cardRepo = mockDeep<CardRepository>();
    boardRepo = mockDeep<BoardRepository>();
    attachmentRepo = mockDeep<CardAttachmentRepository>();
    eventEmitter = mockDeep<EventEmitter2>();

    boardRepo.findById.mockResolvedValue({ id: 'board-1' } as any);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CardAttachmentService,
        { provide: CardRepository, useValue: cardRepo },
        { provide: BoardRepository, useValue: boardRepo },
        { provide: CardAttachmentRepository, useValue: attachmentRepo },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<CardAttachmentService>(CardAttachmentService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should throw EntityNotFoundException if board does not exist', async () => {
    boardRepo.findById.mockResolvedValue(null);

    await expect(
      service.getAttachments('nonexistent-board', 'ws-1', 'card-1'),
    ).rejects.toThrow(EntityNotFoundException);
  });

  describe('addAttachment', () => {
    it('should attach a link/URL to a card and emit event', async () => {
      cardRepo.findActiveById.mockResolvedValue({ id: 'card-1' } as any);
      const mockAttachment = {
        id: 'att-1',
        cardId: 'card-1',
        uploadedById: 'user-1',
        type: AttachmentType.link,
        url: 'https://www.figma.com/file/123/Design',
        name: 'Figma Mockup',
        mimeType: null,
        fileSize: null,
        coverUrl: 'https://cdn.example.com/thumb.png',
        createdAt: new Date(),
        updatedAt: new Date(),
        archivedAt: null,
        uploadedBy: {
          id: 'user-1',
          displayName: 'Alice',
          avatarUrl: null,
        },
      };

      attachmentRepo.create.mockResolvedValue(mockAttachment);

      const result = await service.addAttachment(
        'board-1',
        'ws-1',
        'card-1',
        {
          type: AttachmentType.link,
          url: 'https://www.figma.com/file/123/Design',
          name: 'Figma Mockup',
          coverUrl: 'https://cdn.example.com/thumb.png',
        },
        'user-1',
      );

      expect(result).toEqual(mockAttachment);
      expect(attachmentRepo.create).toHaveBeenCalledWith({
        cardId: 'card-1',
        uploadedById: 'user-1',
        type: AttachmentType.link,
        url: 'https://www.figma.com/file/123/Design',
        name: 'Figma Mockup',
        mimeType: undefined,
        fileSize: undefined,
        coverUrl: 'https://cdn.example.com/thumb.png',
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'attachment.created',
        expect.any(Object),
      );
    });

    it('should throw EntityNotFoundException if card does not exist', async () => {
      cardRepo.findActiveById.mockResolvedValue(null);

      await expect(
        service.addAttachment(
          'board-1',
          'ws-1',
          'nonexistent-card',
          {
            type: AttachmentType.file,
            url: 'https://s3.amazonaws.com/bucket/spec.pdf',
            name: 'spec.pdf',
          },
          'user-1',
        ),
      ).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe('getAttachments', () => {
    it('should return all active attachments for a card', async () => {
      cardRepo.findActiveById.mockResolvedValue({ id: 'card-1' } as any);
      attachmentRepo.findByCardId.mockResolvedValue([
        {
          id: 'att-1',
          cardId: 'card-1',
          uploadedById: 'user-1',
          type: AttachmentType.image,
          url: 'https://s3.amazonaws.com/bucket/photo.png',
          name: 'photo.png',
          mimeType: 'image/png',
          fileSize: 1024,
          coverUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          archivedAt: null,
          uploadedBy: { id: 'user-1', displayName: 'Alice', avatarUrl: null },
        },
      ]);

      const result = await service.getAttachments('board-1', 'ws-1', 'card-1');

      expect(result).toHaveLength(1);
      expect(attachmentRepo.findByCardId).toHaveBeenCalledWith('card-1');
    });

    it('should throw EntityNotFoundException if card does not exist', async () => {
      cardRepo.findActiveById.mockResolvedValue(null);

      await expect(
        service.getAttachments('board-1', 'ws-1', 'nonexistent-card'),
      ).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe('updateAttachment', () => {
    it('should update attachment metadata', async () => {
      cardRepo.findActiveById.mockResolvedValue({ id: 'card-1' } as any);
      attachmentRepo.findById.mockResolvedValue({
        id: 'att-1',
        cardId: 'card-1',
      } as any);
      attachmentRepo.update.mockResolvedValue({
        id: 'att-1',
        cardId: 'card-1',
        name: 'New Name',
        type: AttachmentType.file,
        url: 'https://example.com/file',
        mimeType: 'application/pdf',
        fileSize: 500,
        coverUrl: 'https://example.com/thumb',
      } as any);

      const result = await service.updateAttachment(
        'board-1',
        'ws-1',
        'card-1',
        'att-1',
        {
          name: 'New Name',
          type: AttachmentType.file,
          url: 'https://example.com/file',
          mimeType: 'application/pdf',
          fileSize: 500,
          coverUrl: 'https://example.com/thumb',
        },
      );

      expect(result.name).toBe('New Name');
      expect(attachmentRepo.update).toHaveBeenCalledWith('att-1', {
        name: 'New Name',
        type: AttachmentType.file,
        url: 'https://example.com/file',
        mimeType: 'application/pdf',
        fileSize: 500,
        coverUrl: 'https://example.com/thumb',
      });
    });

    it('should throw EntityNotFoundException if card does not exist during update', async () => {
      cardRepo.findActiveById.mockResolvedValue(null);

      await expect(
        service.updateAttachment('board-1', 'ws-1', 'c-99', 'att-1', { name: 'Name' }),
      ).rejects.toThrow(EntityNotFoundException);
    });

    it('should throw EntityNotFoundException if attachment does not belong to card', async () => {
      cardRepo.findActiveById.mockResolvedValue({ id: 'card-1' } as any);
      attachmentRepo.findById.mockResolvedValue({
        id: 'att-1',
        cardId: 'other-card',
      } as any);

      await expect(
        service.updateAttachment(
          'board-1',
          'ws-1',
          'card-1',
          'att-1',
          { name: 'New Name' },
        ),
      ).rejects.toThrow(EntityNotFoundException);
    });

    it('should throw EntityNotFoundException if attachment does not exist', async () => {
      cardRepo.findActiveById.mockResolvedValue({ id: 'card-1' } as any);
      attachmentRepo.findById.mockResolvedValue(null);

      await expect(
        service.updateAttachment(
          'board-1',
          'ws-1',
          'card-1',
          'att-99',
          { name: 'New Name' },
        ),
      ).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe('deleteAttachment', () => {
    it('should delete attachment and emit event', async () => {
      cardRepo.findActiveById.mockResolvedValue({ id: 'card-1' } as any);
      attachmentRepo.findById.mockResolvedValue({
        id: 'att-1',
        cardId: 'card-1',
      } as any);
      attachmentRepo.delete.mockResolvedValue({ id: 'att-1' } as any);

      await service.deleteAttachment(
        'board-1',
        'ws-1',
        'card-1',
        'att-1',
        'user-1',
      );

      expect(attachmentRepo.delete).toHaveBeenCalledWith('att-1');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'attachment.deleted',
        expect.any(Object),
      );
    });

    it('should throw EntityNotFoundException if card does not exist during deletion', async () => {
      cardRepo.findActiveById.mockResolvedValue(null);

      await expect(
        service.deleteAttachment('board-1', 'ws-1', 'c-99', 'att-1', 'u-1'),
      ).rejects.toThrow(EntityNotFoundException);
    });

    it('should throw EntityNotFoundException if attachment does not exist during deletion', async () => {
      cardRepo.findActiveById.mockResolvedValue({ id: 'card-1' } as any);
      attachmentRepo.findById.mockResolvedValue(null);

      await expect(
        service.deleteAttachment('board-1', 'ws-1', 'card-1', 'att-99', 'u-1'),
      ).rejects.toThrow(EntityNotFoundException);
    });
  });
});
