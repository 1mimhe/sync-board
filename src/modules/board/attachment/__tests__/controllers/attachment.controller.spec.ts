import { AttachmentStatus } from '@prisma/client';
import { CardAttachmentController } from '../../controllers/attachment.controller';
import { FileService } from '../../../../file/services/file.service';
import { BoardRepository } from '../../../core/repositories/board.repository';
import { CardRepository } from '../../../card/repositories/card.repository';
import type { JwtPayload } from '../../../../auth/interfaces/jwt-payload.interface';

describe('CardAttachmentController (file proxy)', () => {
  let controller: CardAttachmentController;
  let fileService: { listForEntity: jest.Mock };
  let boardRepo: { findById: jest.Mock };
  let cardRepo: { findActiveById: jest.Mock };

  const user = { sub: 'user-1' } as JwtPayload;
  const fileRow = (overrides = {}) => ({
    id: 'file-1',
    workspaceId: 'ws-1',
    uploadedBy: 'user-1',
    s3Bucket: 'b',
    s3Key: 'k',
    originalName: 'photo.png',
    mimeType: 'image/png',
    fileSize: 1024,
    entityType: 'card',
    entityId: 'card-1',
    status: AttachmentStatus.completed,
    archivedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  });

  beforeEach(() => {
    fileService = { listForEntity: jest.fn() };
    boardRepo = { findById: jest.fn().mockResolvedValue({ id: 'board-1' }) };
    cardRepo = {
      findActiveById: jest.fn().mockResolvedValue({ id: 'card-1' }),
    };
    controller = new CardAttachmentController(
      fileService as unknown as FileService,
      boardRepo as unknown as BoardRepository,
      cardRepo as unknown as CardRepository,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('delegates listing to FileService and maps to CardAttachmentResponseDto', async () => {
    fileService.listForEntity.mockResolvedValue([fileRow()]);

    const result = await controller.list('ws-1', 'board-1', 'card-1', user);

    expect(fileService.listForEntity).toHaveBeenCalledWith(
      'card',
      'card-1',
      'user-1',
      'ws-1',
    );
    expect(result).toEqual([
      expect.objectContaining({
        id: 'file-1',
        cardId: 'card-1',
        type: 'image',
        url: '',
        name: 'photo.png',
        mimeType: 'image/png',
        fileSize: 1024,
      }),
    ]);
  });

  it('maps non-image MIME types to file type', async () => {
    fileService.listForEntity.mockResolvedValue([
      fileRow({ id: 'file-2', mimeType: 'application/pdf' }),
    ]);

    const result = await controller.list('ws-1', 'board-1', 'card-1', user);

    expect(result[0].type).toBe('file');
    expect(result[0].url).toBe('');
  });

  it('throws when the board is outside the workspace', async () => {
    boardRepo.findById.mockResolvedValue(null);

    await expect(
      controller.list('ws-1', 'board-1', 'card-1', user),
    ).rejects.toThrow();
    expect(fileService.listForEntity).not.toHaveBeenCalled();
  });

  it('exposes no create/update/delete routes', () => {
    expect(
      (controller as unknown as Record<string, unknown>).create,
    ).toBeUndefined();
    expect(
      (controller as unknown as Record<string, unknown>).update,
    ).toBeUndefined();
    expect(
      (controller as unknown as Record<string, unknown>).delete,
    ).toBeUndefined();
  });
});
