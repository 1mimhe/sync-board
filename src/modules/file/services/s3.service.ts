import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Thin wrapper over the S3 client for presigned upload/download URLs
 * and best-effort object deletion. Never logs credentials.
 */
@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly defaultExpiresIn: number;

  constructor(private readonly config: ConfigService) {
    const accessKeyId = config.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = config.get<string>('AWS_SECRET_ACCESS_KEY');
    this.client = new S3Client({
      region: config.get<string>('AWS_REGION', 'us-east-1'),
      ...(config.get<string>('S3_ENDPOINT')
        ? { endpoint: config.get<string>('S3_ENDPOINT') }
        : {}),
      ...(config.get<boolean>('S3_FORCE_PATH_STYLE', false)
        ? { forcePathStyle: true }
        : {}),
      ...(accessKeyId && secretAccessKey
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {}),
    });
    this.bucket = config.get<string>('AWS_S3_BUCKET', 'syncboard-files');
    this.defaultExpiresIn = config.get<number>(
      'S3_PRESIGN_EXPIRES_SECONDS',
      3600,
    );
  }

  /**
   * Creates a presigned PUT URL for direct-to-S3 upload.
   *
   * @param key - S3 object key
   * @param mimeType - Content type bound to the upload
   * @param expiresIn - URL validity in seconds (defaults to config)
   * @returns Presigned PUT URL
   */
  async createPresignedPut(
    key: string,
    mimeType: string,
    expiresIn?: number,
  ): Promise<string> {
    this.logger.debug(`Creating presigned PUT for key ${key}`);
    return getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: mimeType,
      }),
      { expiresIn: expiresIn ?? this.defaultExpiresIn },
    );
  }

  /**
   * Creates a presigned GET URL for downloading bytes.
   *
   * @param key - S3 object key
   * @param expiresIn - URL validity in seconds (defaults to config)
   * @returns Presigned GET URL
   */
  async createPresignedGet(key: string, expiresIn?: number): Promise<string> {
    this.logger.debug(`Creating presigned GET for key ${key}`);
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expiresIn ?? this.defaultExpiresIn },
    );
  }

  /**
   * Best-effort object deletion; callers treat failure as non-fatal.
   *
   * @param key - S3 object key
   * @returns Promise resolving when the attempt completes
   */
  async deleteObject(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      this.logger.debug(`Deleted S3 object ${key}`);
    } catch (error) {
      this.logger.warn(`S3 delete failed for key ${key}`, {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Returns the configured bucket name for row persistence.
   *
   * @returns S3 bucket name
   */
  getBucket(): string {
    return this.bucket;
  }

  /**
   * Returns the default presigned-URL validity for responses.
   *
   * @returns Expiry in seconds
   */
  getDefaultExpiresIn(): number {
    return this.defaultExpiresIn;
  }
}
