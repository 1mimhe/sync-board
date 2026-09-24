import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Response DTO for a single notification. */
export class NotificationResponseDto {
  @ApiProperty({ description: 'Notification UUID' })
  id!: string;

  @ApiProperty({ description: 'Recipient user UUID' })
  userId!: string;

  @ApiProperty({ description: 'Workspace UUID' })
  workspaceId!: string;

  @ApiProperty({ description: 'Notification type' })
  type!: string;

  @ApiProperty({ description: 'Human-readable title', maxLength: 300 })
  title!: string;

  @ApiPropertyOptional({ description: 'Detail text', nullable: true })
  body!: string | null;

  @ApiPropertyOptional({ description: 'Related entity type', nullable: true })
  entityType!: string | null;

  @ApiPropertyOptional({ description: 'Related entity UUID', nullable: true })
  entityId!: string | null;

  @ApiPropertyOptional({
    description: 'Related board UUID when board-scoped',
    nullable: true,
  })
  boardId?: string | null;

  @ApiPropertyOptional({
    description: 'Related card UUID when card-scoped',
    nullable: true,
  })
  cardId?: string | null;

  @ApiProperty({ description: 'Read flag' })
  isRead!: boolean;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: Date;
}

/** Pagination metadata shape. */
export class NotificationPaginationMetaDto {
  @ApiPropertyOptional({
    description: 'Cursor for fetching next page',
    nullable: true,
  })
  cursor!: string | null;

  @ApiProperty({ description: 'Whether additional pages are available' })
  hasMore!: boolean;
}

/** Paginated envelope response for notification listings. */
export class PaginatedNotificationResponseDto {
  @ApiProperty({ type: [NotificationResponseDto], description: 'Page items' })
  items!: NotificationResponseDto[];

  @ApiProperty({
    type: NotificationPaginationMetaDto,
    description: 'Pagination metadata',
  })
  pagination!: NotificationPaginationMetaDto;
}
