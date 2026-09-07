import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CardPriority, CardStatus, Prisma } from '@prisma/client';
import { LabelResponseDto } from '../../label/dto/board-label-response.dto';
import { CommentAuthorDto } from '../../comment/dto/card-comment-response.dto';
import { CardAttachmentResponseDto } from '../../attachment/dto/card-attachment-response.dto';

/**
 * Response DTO representing an assigned user on a card.
 */
export class CardAssigneeUserDto {
  @ApiProperty({
    description: 'Assigned user details',
    type: CommentAuthorDto,
  })
  user!: CommentAuthorDto;
}

/**
 * Response DTO representing a label attached to a card.
 */
export class CardLabelItemDto {
  @ApiProperty({
    description: 'Attached label details',
    type: LabelResponseDto,
  })
  label!: LabelResponseDto;
}

/**
 * Response DTO representing standard card fields and state.
 */
export class CardResponseDto {
  @ApiProperty({
    description: 'Card UUID',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  id!: string;

  @ApiProperty({
    description: 'List UUID',
    example: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  })
  listId!: string;

  @ApiProperty({
    description: 'Card title',
    example: 'Fix login authentication flow',
  })
  title!: string;

  @ApiPropertyOptional({
    description: 'Card description as Tiptap JSON or text',
    nullable: true,
  })
  description!: Prisma.JsonValue | null;

  @ApiProperty({
    description: 'LexoRank ordering string',
    example: '0|i00000:',
  })
  rank!: string;

  @ApiPropertyOptional({
    description: 'Due date timestamp',
    example: '2026-12-31T23:59:59.000Z',
    nullable: true,
  })
  dueDate!: Date | null;

  @ApiProperty({
    description: 'Completion status',
    example: false,
  })
  isComplete!: boolean;

  @ApiPropertyOptional({
    description: 'Cover image URL',
    example: 'https://cdn.example.com/cover.png',
    nullable: true,
  })
  coverImageUrl!: string | null;

  @ApiProperty({
    description: 'Priority stage',
    enum: CardPriority,
    example: 'medium',
  })
  priority!: CardPriority;

  @ApiProperty({
    description: 'Workflow status',
    enum: CardStatus,
    example: 'not_started',
  })
  status!: CardStatus;

  @ApiPropertyOptional({
    description: 'Parent card UUID for subcards',
    format: 'uuid',
    nullable: true,
  })
  parentCardId!: string | null;

  @ApiPropertyOptional({
    description: 'Time estimate in minutes',
    nullable: true,
    example: 120,
  })
  estimateMinutes!: number | null;

  @ApiProperty({
    description: 'Logged minutes (sum of time entries)',
    example: 0,
  })
  loggedMinutes!: number;

  @ApiProperty({
    description: 'Creator user UUID',
    example: 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
  })
  createdBy!: string;

  @ApiProperty({
    description: 'Card creation timestamp',
    example: '2026-08-12T12:00:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Card update timestamp',
    example: '2026-08-12T12:00:00.000Z',
  })
  updatedAt!: Date;

  @ApiPropertyOptional({
    description: 'Card archived timestamp',
    example: null,
    nullable: true,
  })
  archivedAt!: Date | null;

  @ApiPropertyOptional({
    description: 'Card deleted timestamp (permanent delete, not retrievable)',
    example: null,
    nullable: true,
  })
  deletedAt!: Date | null;
}

/**
 * Response DTO representing a card with all attached relations (assignees, labels, attachments).
 */
export class CardWithDetailsResponseDto extends CardResponseDto {
  @ApiProperty({
    description: 'Assigned users list',
    type: [CardAssigneeUserDto],
  })
  assignees!: CardAssigneeUserDto[];

  @ApiProperty({
    description: 'Attached board labels list',
    type: [CardLabelItemDto],
  })
  labels!: CardLabelItemDto[];

  @ApiPropertyOptional({
    description: 'Attached files, images, and links list',
    type: [CardAttachmentResponseDto],
  })
  attachments?: CardAttachmentResponseDto[];

  @ApiPropertyOptional({
    description: 'Direct subcards list',
    type: [CardResponseDto],
  })
  subcards?: CardResponseDto[];

  @ApiPropertyOptional({
    description: 'Parent card summary if this is a subcard',
  })
  parent?: { id: string; title: string } | null;
}

/**
 * Rollup totals for a parent card's active subcards.
 */
export class SubcardRollupDto {
  @ApiProperty({ description: 'Total active subcards', example: 3 })
  total!: number;

  @ApiProperty({
    description: 'Completed subcards (status done/closed)',
    example: 1,
  })
  done!: number;

  @ApiProperty({
    description: 'Sum of subcard estimates in minutes',
    example: 180,
  })
  estimateSum!: number;

  @ApiProperty({ description: 'Sum of subcard logged minutes', example: 45 })
  loggedSum!: number;
}

/**
 * Response DTO for a parent card with active subcards and rollup totals.
 */
export class CardWithSubcardsResponseDto extends CardWithDetailsResponseDto {
  @ApiProperty({ description: 'Active subcards', type: [CardResponseDto] })
  declare subcards: CardResponseDto[];

  @ApiProperty({
    description: 'Aggregated subcard totals',
    type: SubcardRollupDto,
  })
  subcardRollup!: SubcardRollupDto;
}

/**
 * Response DTO for card time-tracking summary with paginated entries.
 */
export class TimeTrackingResponseDto {
  @ApiPropertyOptional({
    description: 'Estimate in minutes',
    nullable: true,
    example: 120,
  })
  estimate!: number | null;

  @ApiProperty({ description: 'Logged minutes', example: 45 })
  logged!: number;

  @ApiProperty({
    description: 'Remaining minutes (max(0, estimate - logged))',
    example: 75,
  })
  remaining!: number;

  @ApiProperty({ description: 'Paginated time entries' })
  entries!: {
    items: object[];
    pagination: { cursor: string | null; hasMore: boolean };
  };
}
