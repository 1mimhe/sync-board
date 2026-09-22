import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { S3Service } from '../services/s3.service';

describe('S3Service', () => {
  let service: S3Service;

  beforeEach(async () => {
    const config = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        const values: Record<string, unknown> = {
          AWS_REGION: 'us-east-1',
          AWS_ACCESS_KEY_ID: 'test-key',
          AWS_SECRET_ACCESS_KEY: 'test-secret',
          AWS_S3_BUCKET: 'test-bucket',
          S3_PRESIGN_EXPIRES_SECONDS: 3600,
        };
        return values[key] ?? defaultValue;
      }),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [S3Service, { provide: ConfigService, useValue: config }],
    }).compile();
    service = module.get(S3Service);
  });

  it('creates a presigned PUT URL containing bucket and key', async () => {
    const url = await service.createPresignedPut('k/a.png', 'image/png');
    expect(url).toContain('test-bucket');
    expect(url).toContain('k/a.png');
  });

  it('creates a presigned GET URL containing bucket and key', async () => {
    const url = await service.createPresignedGet('k/a.png');
    expect(url).toContain('test-bucket');
    expect(url).toContain('k/a.png');
  });

  it('exposes bucket and expiry for row persistence', () => {
    expect(service.getBucket()).toBe('test-bucket');
    expect(service.getDefaultExpiresIn()).toBe(3600);
  });
});
