import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Data transfer object for moving or reordering a card within or across lists.
 */
export class MoveCardDto {
  @ApiProperty({
    description: 'Target list UUID',
    example: 'd9b2b0b1-4c3e-4b6e-8d2b-1a2b3c4d5e6f',
  })
  @IsUUID('4')
  targetListId!: string;

  @ApiPropertyOptional({
    description:
      'LexoRank string of card before target position in target list',
    example: '0|i00000:',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(({ value }: { value?: string }) => value?.trim())
  prevRank?: string;

  @ApiPropertyOptional({
    description: 'LexoRank string of card after target position in target list',
    example: '0|i00008:',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(({ value }: { value?: string }) => value?.trim())
  nextRank?: string;
}
