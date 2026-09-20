import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Response DTO representing an activity event item.
 */
export class ActivityEventResponseDto {
  @ApiProperty({
    description: 'Monotonic event id (decimal string of a bigint)',
  })
  id!: string;

  @ApiProperty({ description: 'Workspace UUID the event belongs to' })
  workspaceId!: string;

  @ApiPropertyOptional({
    description: 'Board UUID when board-scoped',
    nullable: true,
  })
  boardId!: string | null;

  @ApiProperty({ description: 'Type of entity acted upon' })
  entityType!: string;

  @ApiProperty({ description: 'UUID of the entity acted upon' })
  entityId!: string;

  @ApiProperty({ description: 'Action performed on the entity' })
  action!: string;

  @ApiProperty({ description: 'UUID of the acting user' })
  actorId!: string;

  @ApiProperty({
    description: 'Action payload (entityTitle, list moves, etc.)',
  })
  payload!: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Additional metadata', nullable: true })
  metadata!: Record<string, unknown> | null;

  @ApiProperty({ description: 'When the event occurred' })
  createdAt!: Date;
}

/**
 * Pagination metadata shape for composite-cursor activity feeds.
 */
export class ActivityPaginationMetaDto {
  @ApiPropertyOptional({
    description: 'Composite cursor for fetching the next page',
    nullable: true,
  })
  cursor!: string | null;

  @ApiProperty({ description: 'Whether additional pages are available' })
  hasMore!: boolean;
}

/**
 * Paginated envelope response for activity event listings.
 */
export class PaginatedActivityEventResponseDto {
  @ApiProperty({
    type: [ActivityEventResponseDto],
    description: 'List of activity event items',
  })
  items!: ActivityEventResponseDto[];

  @ApiProperty({
    type: ActivityPaginationMetaDto,
    description: 'Pagination metadata with composite cursor',
  })
  pagination!: ActivityPaginationMetaDto;
}

