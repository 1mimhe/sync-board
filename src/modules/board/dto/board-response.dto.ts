import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ListWithCardsResponseDto } from './list-response.dto';
import { BoardLabelResponseDto } from './board-label-response.dto';

/**
 * Response DTO representing standard board metadata.
 */
export class BoardResponseDto {
  @ApiProperty({
    description: 'Board UUID',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  id!: string;

  @ApiProperty({
    description: 'Workspace UUID',
    example: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  })
  workspaceId!: string;

  @ApiProperty({
    description: 'Board title',
    example: 'Sprint Planning',
  })
  title!: string;

  @ApiPropertyOptional({
    description: 'Board description',
    example: 'Sprint delivery board',
    nullable: true,
  })
  description!: string | null;

  @ApiPropertyOptional({
    description: 'Board background hex color',
    example: '#1A1A2E',
    nullable: true,
  })
  backgroundColor!: string | null;

  @ApiProperty({
    description: 'Creator user UUID',
    example: 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
  })
  createdBy!: string;

  @ApiProperty({
    description: 'Board creation timestamp',
    example: '2026-08-12T12:00:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Board update timestamp',
    example: '2026-08-12T12:00:00.000Z',
  })
  updatedAt!: Date;

  @ApiPropertyOptional({
    description: 'Board archived timestamp',
    example: null,
    nullable: true,
  })
  archivedAt!: Date | null;
}

/**
 * Response DTO representing pagination metadata for board lists and cards.
 */
export class BoardContentPaginationDto {
  @ApiProperty({ description: 'Current page of lists', example: 1 })
  listPage!: number;

  @ApiProperty({ description: 'Number of lists per page', example: 50 })
  listPageSize!: number;

  @ApiProperty({ description: 'Total non-archived lists on board', example: 7 })
  totalLists!: number;

  @ApiProperty({ description: 'Total pages of lists', example: 1 })
  totalPages!: number;

  @ApiProperty({
    description: 'Number of cards loaded per list',
    example: 50,
  })
  cardPageSize!: number;

  @ApiProperty({
    description: 'Total non-archived cards on board',
    example: 34,
  })
  totalCards!: number;
}

/**
 * Response DTO representing a board with its full nested content (lists, cards, labels, pagination).
 */
export class BoardWithContentResponseDto extends BoardResponseDto {
  @ApiProperty({
    description: 'Whether current user has starred this board',
    example: true,
  })
  isStarred!: boolean;

  @ApiProperty({
    description: 'Nested lists and cards structure',
    type: [ListWithCardsResponseDto],
  })
  lists!: ListWithCardsResponseDto[];

  @ApiProperty({
    description: 'Board labels list',
    type: [BoardLabelResponseDto],
  })
  labels!: BoardLabelResponseDto[];

  @ApiProperty({
    description: 'Board content pagination metadata',
    type: BoardContentPaginationDto,
  })
  pagination!: BoardContentPaginationDto;
}
