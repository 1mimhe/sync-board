import { AttachmentStatus } from '@prisma/client';
import { FileController } from '../controllers/file.controller';
import { FileService } from '../services/file.service';
import type { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

describe('FileController', () => {
  let controller: FileController;
  let fileService: {
    requestUpload: jest.Mock;
    confirm: jest.Mock;
    download: jest.Mock;
    delete: jest.Mock;
  };

  const user = { sub: 'user-1' } as JwtPayload;

  beforeEach(() => {
    fileService = {
      requestUpload: jest.fn(),
      confirm: jest.fn(),
      download: jest.fn(),
      delete: jest.fn(),
    };
    controller = new FileController(fileService as unknown as FileService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('maps requestUpload to the presigned response shape', async () => {
    fileService.requestUpload.mockResolvedValue({
      fileId: 'file-1',
      uploadUrl: 'https://put',
      s3Key: 'k',
      expiresIn: 3600,
    });

    const result = await controller.requestUpload(
      'ws-1',
      {
        fileName: 'x.png',
        mimeType: 'image/png',
        fileSize: 10,
        entityType: 'card',
        entityId: 'card-1',
      },
      user,
    );

    expect(fileService.requestUpload).toHaveBeenCalledWith(
      'ws-1',
      expect.objectContaining({ fileName: 'x.png' }),
      'user-1',
    );
    expect(result).toEqual(
      expect.objectContaining({ fileId: 'file-1', expiresIn: 3600 }),
    );
  });

  it('maps confirm to the confirm response shape', async () => {
    fileService.confirm.mockResolvedValue({
      id: 'file-1',
      status: AttachmentStatus.completed,
    });

    const result = await controller.confirm('file-1', user);

    expect(fileService.confirm).toHaveBeenCalledWith('file-1', 'user-1');
    expect(result).toEqual({
      fileId: 'file-1',
      status: AttachmentStatus.completed,
    });
  });

  it('maps download to the download response shape', async () => {
    fileService.download.mockResolvedValue({
      downloadUrl: 'https://get',
      expiresIn: 3600,
    });

    const result = await controller.download('file-1', user);

    expect(result).toEqual({
      downloadUrl: 'https://get',
      expiresIn: 3600,
    });
  });

  it('delegates delete to the service', async () => {
    await controller.delete('file-1', user);
    expect(fileService.delete).toHaveBeenCalledWith('file-1', 'user-1');
  });
});
