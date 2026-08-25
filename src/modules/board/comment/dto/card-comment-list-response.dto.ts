import { ApiProperty } from '@nestjs/swagger';
import { CardCommentResponseDto } from './card-comment-response.dto';

/**
 * Response DTO representing cursor pagination metadata.
 */
export class CursorPaginationMetaDto {
  /** Last item id of the current page; null when no further pages */
  @ApiProperty({
    description: "Cursor: last item's id of this page (null when no more)",
    example: '550e8400-e29b-41d4-a716-446655440000',
    nullable: true,
    oneOf: [{ type: 'string' }, { type: 'null' }],
  })
  cursor!: string | null;

  /** Whether further pages exist */
  @ApiProperty({ description: 'Whether more items exist', example: true })
  hasMore!: boolean;
}

/**
 * Response DTO representing a cursor-paginated list of card comments:
 * `{ items, pagination }`.
 */
export class PaginatedCommentsResponseDto {
  @ApiProperty({
    description: 'Comments on this page',
    type: [CardCommentResponseDto],
  })
  items!: CardCommentResponseDto[];

  @ApiProperty({
    description: 'Cursor pagination metadata',
    type: CursorPaginationMetaDto,
  })
  pagination!: CursorPaginationMetaDto;
}
