import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AttachmentStatus, WorkspaceRole } from '@prisma/client';
import { FileService } from '../services/file.service';
import { FileRepository } from '../repositories/file.repository';
import { S3Service } from '../services/s3.service';
import { WorkspaceMemberRepository } from '../../workspace/repositories/workspace-member.repository';
import { MembershipService } from '../../workspace/services/membership.service';
import { CardRepository } from '../../board/card/repositories/card.repository';
import { DocumentService } from '../../document/services/document.service';
import {
  BusinessRuleException,
  EntityNotFoundException,
} from '../../../common/exceptions/app.exception';

describe('FileService', () => {
  let service: FileService;
  let fileRepo: {
    createPending: jest.Mock;
    findActiveById: jest.Mock;
    confirm: jest.Mock;
    listForEntity: jest.Mock;
    archive: jest.Mock;
    markStalePendingAsFailed: jest.Mock;
  };
  let s3: {
    createPresignedPut: jest.Mock;
    createPresignedGet: jest.Mock;
    deleteObject: jest.Mock;
    getBucket: jest.Mock;
  };
  let memberRepo: { findMember: jest.Mock };
  let cardRepo: { findActiveById: jest.Mock };
  let documentService: { findById: jest.Mock };
  let config: { get: jest.Mock };

  const row = (overrides = {}) => ({
    id: 'file-1',
    workspaceId: 'ws-1',
    uploadedBy: 'user-1',
    s3Bucket: 'b',
    s3Key: 'workspaces/ws-1/cards/card-1/abc-x.png',
    originalName: 'x.png',
    mimeType: 'image/png',
    fileSize: 1024,
    entityType: 'card',
    entityId: 'card-1',
    status: AttachmentStatus.pending,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const uploadDto = () => ({
    fileName: 'x.png',
    mimeType: 'image/png',
    fileSize: 1024,
    entityType: 'card' as const,
    entityId: 'card-1',
  });

  beforeEach(async () => {
    fileRepo = {
      createPending: jest.fn(),
      findActiveById: jest.fn(),
      confirm: jest.fn(),
      listForEntity: jest.fn(),
      archive: jest.fn(),
      markStalePendingAsFailed: jest.fn(),
    };
    s3 = {
      createPresignedPut: jest.fn().mockResolvedValue('https://put'),
      createPresignedGet: jest.fn().mockResolvedValue('https://get'),
      deleteObject: jest.fn().mockResolvedValue(undefined),
      getBucket: jest.fn().mockReturnValue('b'),
    };
    memberRepo = {
      findMember: jest.fn().mockResolvedValue({ role: WorkspaceRole.member }),
    };
    cardRepo = {
      findActiveById: jest.fn().mockResolvedValue({ id: 'card-1' }),
    };
    documentService = { findById: jest.fn() };
    config = {
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'MAX_FILE_SIZE_BYTES') return 26214400;
        if (key === 'S3_PRESIGN_EXPIRES_SECONDS') return 3600;
        return fallback;
      }),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileService,
        { provide: FileRepository, useValue: fileRepo },
        { provide: S3Service, useValue: s3 },
        { provide: ConfigService, useValue: config },
        {
          provide: MembershipService,
          useValue: { requireWorkspace: jest.fn() },
        },
        { provide: WorkspaceMemberRepository, useValue: memberRepo },
        { provide: CardRepository, useValue: cardRepo },
        { provide: DocumentService, useValue: documentService },
      ],
    }).compile();
    service = module.get(FileService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('requestUpload', () => {
    it('creates a pending row and returns presigned details', async () => {
      fileRepo.createPending.mockResolvedValue(row());

      const result = await service.requestUpload('ws-1', uploadDto(), 'user-1');

      expect(result).toEqual(
        expect.objectContaining({
          fileId: 'file-1',
          uploadUrl: 'https://put',
          expiresIn: 3600,
        }),
      );
      expect(fileRepo.createPending).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pending', uploadedBy: 'user-1' }),
      );
    });

    it('rejects disallowed MIME types with MIME_NOT_ALLOWED (422)', async () => {
      await expect(
        service.requestUpload(
          'ws-1',
          { ...uploadDto(), mimeType: 'application/x-sh' },
          'user-1',
        ),
      ).rejects.toMatchObject({
        errorCode: 'MIME_NOT_ALLOWED',
        status: 422,
      } as unknown as BusinessRuleException);
    });

    it('rejects oversize files with FILE_TOO_LARGE', async () => {
      await expect(
        service.requestUpload(
          'ws-1',
          { ...uploadDto(), fileSize: 26214401 },
          'user-1',
        ),
      ).rejects.toMatchObject({ errorCode: 'FILE_TOO_LARGE' });
    });

    it('throws 404 when the card host does not exist', async () => {
      cardRepo.findActiveById.mockResolvedValue(null);
      await expect(
        service.requestUpload('ws-1', uploadDto(), 'user-1'),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });

    it('throws 403 for non-members', async () => {
      memberRepo.findMember.mockResolvedValue(null);
      await expect(
        service.requestUpload('ws-1', uploadDto(), 'user-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('confirm', () => {
    it('transitions pending to completed for the owner', async () => {
      fileRepo.findActiveById.mockResolvedValue(row());
      fileRepo.confirm.mockResolvedValue(
        row({ status: AttachmentStatus.completed }),
      );

      const result = await service.confirm('file-1', 'user-1');

      expect(result.status).toBe(AttachmentStatus.completed);
      expect(fileRepo.confirm).toHaveBeenCalledWith('file-1');
    });

    it('returns completed rows idempotently without a second write', async () => {
      fileRepo.findActiveById.mockResolvedValue(
        row({ status: AttachmentStatus.completed }),
      );

      const result = await service.confirm('file-1', 'user-1');

      expect(result.status).toBe(AttachmentStatus.completed);
      expect(fileRepo.confirm).not.toHaveBeenCalled();
    });

    it('allows workspace admins to confirm foreign uploads', async () => {
      memberRepo.findMember.mockResolvedValue({ role: WorkspaceRole.admin });
      fileRepo.findActiveById.mockResolvedValue(row({ uploadedBy: 'other' }));
      fileRepo.confirm.mockResolvedValue(
        row({ status: AttachmentStatus.completed }),
      );

      await expect(service.confirm('file-1', 'admin-1')).resolves.toBeDefined();
    });

    it('rejects strangers with 403', async () => {
      memberRepo.findMember.mockResolvedValue({ role: WorkspaceRole.viewer });
      fileRepo.findActiveById.mockResolvedValue(row({ uploadedBy: 'other' }));

      await expect(service.confirm('file-1', 'user-2')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('download', () => {
    it('allows viewers to download completed files', async () => {
      memberRepo.findMember.mockResolvedValue({ role: WorkspaceRole.viewer });
      fileRepo.findActiveById.mockResolvedValue(
        row({ status: AttachmentStatus.completed }),
      );

      const result = await service.download('file-1', 'viewer-1');

      expect(result).toEqual({ downloadUrl: 'https://get', expiresIn: 3600 });
    });

    it('throws 404 for pending uploads', async () => {
      fileRepo.findActiveById.mockResolvedValue(row());

      await expect(service.download('file-1', 'user-1')).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );
    });
  });

  describe('listForEntity', () => {
    it('returns rows scoped to the workspace, newest first', async () => {
      fileRepo.listForEntity.mockResolvedValue([
        row(),
        row({ id: 'file-2', workspaceId: 'ws-other' }),
      ]);

      const result = await service.listForEntity(
        'card',
        'card-1',
        'user-1',
        'ws-1',
      );

      expect(fileRepo.listForEntity).toHaveBeenCalledWith('card', 'card-1');
      expect(result.map((r) => r.id)).toEqual(['file-1']);
    });
  });

  describe('delete', () => {
    it('archives the row and best-effort deletes the object', async () => {
      fileRepo.findActiveById.mockResolvedValue(
        row({ status: AttachmentStatus.completed }),
      );

      await service.delete('file-1', 'user-1');

      expect(fileRepo.archive).toHaveBeenCalledWith('file-1');
      expect(s3.deleteObject).toHaveBeenCalled();
    });

    it('still archives when S3 deletion fails', async () => {
      fileRepo.findActiveById.mockResolvedValue(
        row({ status: AttachmentStatus.completed }),
      );
      s3.deleteObject.mockRejectedValue(new Error('S3 down'));

      await expect(service.delete('file-1', 'user-1')).resolves.toBeUndefined();
      expect(fileRepo.archive).toHaveBeenCalledWith('file-1');
    });

    it('rejects non-uploader non-admins with 403', async () => {
      memberRepo.findMember.mockResolvedValue({ role: WorkspaceRole.member });
      fileRepo.findActiveById.mockResolvedValue(
        row({ uploadedBy: 'other', status: AttachmentStatus.completed }),
      );

      await expect(service.delete('file-1', 'user-2')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });
});
