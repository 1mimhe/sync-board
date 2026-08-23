import { CardAttachmentController } from '../../controllers/card-attachment.controller';
import { CardAttachmentService } from '../../services/card-attachment.service';
import type { JwtPayload } from '../../../auth/interfaces/jwt-payload.interface';

describe('CardAttachmentController', () => {
  let controller: CardAttachmentController;
  let attachmentService: jest.Mocked<CardAttachmentService>;

  const mockUser: JwtPayload = {
    sub: 'user-uuid-1',
    email: 'user@test.com',
    jti: 'jti-1',
  };

  const mockAttachment = {
    id: 'att-1',
    cardId: 'card-1',
    type: 'file' as any,
    url: 'https://example.com/file.pdf',
    name: 'document.pdf',
    mimeType: 'application/pdf',
    fileSize: 1024,
    coverUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    uploadedBy: {
      id: 'user-uuid-1',
      displayName: 'User',
      avatarUrl: null,
    },
  };

  beforeEach(() => {
    attachmentService = {
      addAttachment: jest.fn(),
      getAttachments: jest.fn(),
      updateAttachment: jest.fn(),
      deleteAttachment: jest.fn(),
    } as unknown as jest.Mocked<CardAttachmentService>;

    controller = new CardAttachmentController(attachmentService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('create', () => {
    it('should add attachment to card', async () => {
      attachmentService.addAttachment.mockResolvedValue(mockAttachment as any);

      const result = await controller.create(
        'ws-1',
        'board-1',
        'card-1',
        { name: 'document.pdf', url: 'https://example.com/file.pdf', type: 'file' as any },
        mockUser,
      );

      expect(attachmentService.addAttachment).toHaveBeenCalledWith(
        'board-1',
        'ws-1',
        'card-1',
        { name: 'document.pdf', url: 'https://example.com/file.pdf', type: 'file' },
        'user-uuid-1',
      );
      expect(result.id).toBe('att-1');
      expect(result.name).toBe('document.pdf');
    });
  });

  describe('list', () => {
    it('should list attachments on card', async () => {
      attachmentService.getAttachments.mockResolvedValue([mockAttachment as any]);

      const result = await controller.list('ws-1', 'board-1', 'card-1');

      expect(attachmentService.getAttachments).toHaveBeenCalledWith('board-1', 'ws-1', 'card-1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('att-1');
    });
  });

  describe('update', () => {
    it('should update attachment metadata', async () => {
      attachmentService.updateAttachment.mockResolvedValue({ ...mockAttachment, name: 'renamed.pdf' } as any);

      const result = await controller.update(
        'ws-1',
        'board-1',
        'card-1',
        'att-1',
        { name: 'renamed.pdf' },
      );

      expect(attachmentService.updateAttachment).toHaveBeenCalledWith(
        'board-1',
        'ws-1',
        'card-1',
        'att-1',
        { name: 'renamed.pdf' },
      );
      expect(result.name).toBe('renamed.pdf');
    });
  });

  describe('delete', () => {
    it('should delete attachment', async () => {
      attachmentService.deleteAttachment.mockResolvedValue(undefined as any);

      await controller.delete('ws-1', 'board-1', 'card-1', 'att-1', mockUser);

      expect(attachmentService.deleteAttachment).toHaveBeenCalledWith(
        'board-1',
        'ws-1',
        'card-1',
        'att-1',
        'user-uuid-1',
      );
    });
  });
});
