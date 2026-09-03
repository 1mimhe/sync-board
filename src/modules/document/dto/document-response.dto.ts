import { ApiProperty } from '@nestjs/swagger';
import { DocumentStatus } from '@prisma/client';

/** Public document representation — never exposes yjsState or previewText. */
export class DocumentResponseDto {
  /** Document UUID */
  @ApiProperty({ description: 'Document UUID', format: 'uuid' })
  id!: string;

  /** Owning workspace UUID */
  @ApiProperty({ description: 'Workspace UUID', format: 'uuid' })
  workspaceId!: string;

  /** Document title */
  @ApiProperty({ description: 'Document title', example: 'Sprint retro notes' })
  title!: string;

  /** Linked parent card UUID, if any */
  @ApiProperty({
    description: 'Parent card UUID when the document is linked to a card',
    nullable: true,
    format: 'uuid',
  })
  parentCardId!: string | null;

  /** Optional parent card summary */
  @ApiProperty({
    description: 'Parent card summary if linked to a card',
    required: false,
    nullable: true,
  })
  parentCard?: { id: string; title: string } | null;

  /** Creator user UUID */
  @ApiProperty({ description: 'Creator user UUID', format: 'uuid' })
  createdBy!: string;

  /** Document lifecycle status */
  @ApiProperty({ description: 'Document status', enum: DocumentStatus })
  status!: DocumentStatus;

  /** Creation timestamp */
  @ApiProperty({ description: 'Creation timestamp', format: 'date-time' })
  createdAt!: Date;

  /** Last update timestamp */
  @ApiProperty({ description: 'Last update timestamp', format: 'date-time' })
  updatedAt!: Date;
}

/** Pagination envelope metadata. */
export class PaginationMetaDto {
  /** Cursor of the last item of this page (null when no more pages) */
  @ApiProperty({
    description: "Cursor: last item's id from this page",
    nullable: true,
  })
  cursor!: string | null;

  /** Whether more items exist after this page */
  @ApiProperty({ description: 'Whether a next page exists' })
  hasMore!: boolean;
}

/** Paginated documents envelope. */
export class PaginatedDocumentsResponseDto {
  /** Page items */
  @ApiProperty({
    description: 'Documents of this page',
    type: [DocumentResponseDto],
  })
  items!: DocumentResponseDto[];

  /** Pagination metadata */
  @ApiProperty({ description: 'Pagination metadata', type: PaginationMetaDto })
  pagination!: PaginationMetaDto;
}
