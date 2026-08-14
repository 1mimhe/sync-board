import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CardWithDetailsResponseDto } from './card-response.dto';

/**
 * Response DTO representing standard list metadata.
 */
export class ListResponseDto {
  @ApiProperty({
    description: 'List UUID',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  id!: string;

  @ApiProperty({
    description: 'Board UUID',
    example: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  })
  boardId!: string;

  @ApiProperty({
    description: 'List title',
    example: 'In Progress',
  })
  title!: string;

  @ApiProperty({
    description: 'LexoRank ordering string',
    example: '0|i00000:',
  })
  rank!: string;

  @ApiProperty({
    description: 'List creation timestamp',
    example: '2026-08-12T12:00:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'List update timestamp',
    example: '2026-08-12T12:00:00.000Z',
  })
  updatedAt!: Date;

  @ApiPropertyOptional({
    description: 'List archived timestamp',
    example: null,
    nullable: true,
  })
  archivedAt!: Date | null;
}

/**
 * Response DTO representing a list with its nested cards and card count.
 */
export class ListWithCardsResponseDto extends ListResponseDto {
  @ApiProperty({
    description: 'Cards inside this list sorted by rank',
    type: [CardWithDetailsResponseDto],
  })
  cards!: CardWithDetailsResponseDto[];

  @ApiProperty({
    description: 'Total non-archived cards in the list (for pagination)',
    example: 12,
  })
  cardCount!: number;
}
