import { ApiProperty } from '@nestjs/swagger';

/**
 * Response DTO representing a single checklist item.
 */
export class ChecklistItemResponseDto {
  @ApiProperty({
    description: 'Checklist item UUID',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  id!: string;

  @ApiProperty({
    description: 'Parent checklist UUID',
    example: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  })
  checklistId!: string;

  @ApiProperty({
    description: 'Item content text',
    example: 'Code reviewed by two developers',
  })
  content!: string;

  @ApiProperty({
    description: 'Completion state',
    example: false,
  })
  isDone!: boolean;

  @ApiProperty({
    description: 'Lexorank ordering string within the checklist',
    example: '0|h000zz:',
  })
  rank!: string;

  @ApiProperty({
    description: 'Item creation timestamp',
    example: '2026-08-12T12:00:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Item update timestamp',
    example: '2026-08-12T12:00:00.000Z',
  })
  updatedAt!: Date;
}

/**
 * Response DTO representing a card checklist with its ordered items.
 */
export class ChecklistResponseDto {
  @ApiProperty({
    description: 'Checklist UUID',
    example: 'c3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
  })
  id!: string;

  @ApiProperty({
    description: 'Parent card UUID',
    example: 'd4eebc99-9c0b-4ef8-bb6d-6bb9bd380a55',
  })
  cardId!: string;

  @ApiProperty({
    description: 'Checklist title',
    example: 'Definition of Done',
  })
  title!: string;

  @ApiProperty({
    description: 'Lexorank ordering string within the card',
    example: '0|g0000:',
  })
  rank!: string;

  @ApiProperty({
    description: 'Ordered checklist items',
    type: [ChecklistItemResponseDto],
  })
  items!: ChecklistItemResponseDto[];

  @ApiProperty({
    description: 'Checklist creation timestamp',
    example: '2026-08-12T12:00:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Checklist update timestamp',
    example: '2026-08-12T12:00:00.000Z',
  })
  updatedAt!: Date;
}
