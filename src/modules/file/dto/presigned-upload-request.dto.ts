import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { SUPPORTED_ENTITY_TYPES } from '../constants/file.constants';
import type { FileEntityType } from '../interfaces/file.interfaces';

/**
 * Request payload for initiating a 2-phase S3 upload.
 * The server validates, creates a pending row, and returns a presigned PUT URL.
 */
export class PresignedUploadRequestDto {
  @ApiProperty({
    description: 'Original file name',
    minLength: 1,
    maxLength: 255,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  @Transform(({ value }) => value?.trim())
  fileName!: string;

  @ApiProperty({ description: 'File MIME type', example: 'application/pdf' })
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  mimeType!: string;

  @ApiProperty({
    description:
      'File size in bytes (transport sanity cap; FileService enforces MAX_FILE_SIZE_BYTES)',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(104857600)
  fileSize!: number;

  @ApiProperty({
    description: 'Hosting entity type',
    enum: SUPPORTED_ENTITY_TYPES,
  })
  @IsEnum(SUPPORTED_ENTITY_TYPES)
  entityType!: FileEntityType;

  @ApiProperty({ description: 'Hosting entity UUID', format: 'uuid' })
  @IsUUID('4')
  entityId!: string;
}
