import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ActionType, EntityType, Prisma } from '@prisma/client';

/**
 * Response DTO representing the user who performed an activity.
 */
class ActivityUserDto {
  @ApiProperty({ description: 'User UUID' })
  id!: string;

  @ApiProperty({ description: 'User display name' })
  displayName!: string;

  @ApiPropertyOptional({ description: 'User avatar URL', nullable: true })
  avatarUrl!: string | null;
}

/**
 * Response DTO representing an activity log entry.
 */
export class ActivityResponseDto {
  @ApiProperty({ description: 'Activity UUID' })
  id!: string;

  @ApiProperty({ description: 'Board UUID' })
  boardId!: string;

  @ApiProperty({
    description: 'User who performed the action',
    type: ActivityUserDto,
  })
  user!: ActivityUserDto;

  @ApiProperty({ enum: ActionType, description: 'Type of action' })
  action!: ActionType;

  @ApiProperty({ enum: EntityType, description: 'Type of entity' })
  entityType!: EntityType;

  @ApiProperty({ description: 'UUID of the entity acted upon' })
  entityId!: string;

  @ApiPropertyOptional({
    description: 'Title or name of the entity for context',
    nullable: true,
  })
  entityTitle!: string | null;

  @ApiPropertyOptional({
    description: 'Source list UUID (for move actions)',
    nullable: true,
  })
  fromListId!: string | null;

  @ApiPropertyOptional({
    description: 'Target list UUID (for move actions)',
    nullable: true,
  })
  toListId!: string | null;

  @ApiPropertyOptional({
    description: 'Additional metadata as JSON',
    nullable: true,
  })
  details!: Prisma.JsonValue | null;

  @ApiProperty({ description: 'When the activity occurred' })
  createdAt!: Date;
}
