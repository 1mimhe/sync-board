import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { AttachmentType } from '@prisma/client';

/**
 * Data transfer object for adding a file, image, or link attachment to a card.
 */
export class CreateCardAttachmentDto {
  @ApiPropertyOptional({
    description: 'Type of attachment: file, image, or link',
    enum: AttachmentType,
    example: AttachmentType.link,
    default: AttachmentType.file,
  })
  @IsOptional()
  @IsEnum(AttachmentType)
  type?: AttachmentType = AttachmentType.file;

  @ApiProperty({
    description:
      'Target resource URL (uploaded file URL, CDN link, or external web link)',
    example: 'https://www.figma.com/file/xyz123/SyncBoard-Design',
    minLength: 1,
    maxLength: 2000,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  @Transform(({ value }: { value?: string }) => value?.trim())
  url!: string;

  @ApiProperty({
    description: 'Display name or file title of the attachment',
    example: 'Figma Design System',
    minLength: 1,
    maxLength: 255,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  @Transform(({ value }: { value?: string }) => value?.trim())
  name!: string;

  @ApiPropertyOptional({
    description: 'MIME type of the file (e.g. application/pdf, image/png)',
    example: 'application/pdf',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }: { value?: string }) => value?.trim())
  mimeType?: string;

  @ApiPropertyOptional({
    description: 'File size in bytes',
    example: 1048576,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  fileSize?: number;

  @ApiPropertyOptional({
    description: 'Thumbnail / preview image URL',
    example: 'https://cdn.syncboard.dev/thumbnails/xyz.png',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }: { value?: string }) => value?.trim())
  coverUrl?: string;
}
