import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttachmentType } from '@prisma/client';
import { CommentAuthorDto } from '../../comment/dto/card-comment-response.dto';

/**
 * Response DTO representing an attachment (file, image, or external link) on a card.
 */
export class CardAttachmentResponseDto {
  @ApiProperty({
    description: 'Attachment UUID',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  id!: string;

  @ApiProperty({
    description: 'Card UUID',
    example: 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  })
  cardId!: string;

  @ApiProperty({
    description: 'User who uploaded/added the attachment',
    type: CommentAuthorDto,
  })
  uploadedBy!: CommentAuthorDto;

  @ApiProperty({
    description: 'Type of attachment: file, image, or link',
    enum: AttachmentType,
    example: AttachmentType.link,
  })
  type!: AttachmentType;

  @ApiProperty({
    description: 'Resource URL or external web link',
    example: 'https://www.figma.com/file/xyz123/SyncBoard-Design',
  })
  url!: string;

  @ApiProperty({
    description: 'Display title or file name',
    example: 'Figma UI Mockup',
  })
  name!: string;

  @ApiPropertyOptional({
    description: 'MIME type of the file',
    example: 'application/pdf',
    nullable: true,
  })
  mimeType!: string | null;

  @ApiPropertyOptional({
    description: 'File size in bytes',
    example: 1048576,
    nullable: true,
  })
  fileSize!: number | null;

  @ApiPropertyOptional({
    description: 'Cover / preview thumbnail URL',
    example: 'https://cdn.syncboard.dev/thumbnails/xyz.png',
    nullable: true,
  })
  coverUrl!: string | null;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2026-08-14T12:00:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Update timestamp',
    example: '2026-08-14T12:00:00.000Z',
  })
  updatedAt!: Date;
}
