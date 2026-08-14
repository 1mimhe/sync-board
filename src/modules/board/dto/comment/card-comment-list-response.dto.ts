import { ApiProperty } from '@nestjs/swagger';
import { CardCommentResponseDto } from './card-comment-response.dto';

/**
 * Response DTO representing pagination metadata for comment lists.
 */
export class PaginationMetaDto {
  @ApiProperty({ description: 'Current page (1-based)', example: 1 })
  page!: number;

  @ApiProperty({ description: 'Items per page', example: 20 })
  pageSize!: number;

  @ApiProperty({ description: 'Total items', example: 45 })
  total!: number;

  @ApiProperty({ description: 'Total pages', example: 3 })
  totalPages!: number;
}

/**
 * Response DTO representing a paginated list of card comments.
 */
export class PaginatedCommentsResponseDto {
  @ApiProperty({
    description: 'Comments on this page',
    type: [CardCommentResponseDto],
  })
  items!: CardCommentResponseDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: PaginationMetaDto,
  })
  meta!: PaginationMetaDto;
}
