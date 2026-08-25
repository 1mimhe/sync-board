import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Data transfer object for reordering a list using LexoRank positions.
 */
export class MoveListDto {
  @ApiPropertyOptional({
    description: 'LexoRank string of the list before target position',
    example: '0|i00000:',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(({ value }: { value?: string }) => value?.trim())
  prevRank?: string;

  @ApiPropertyOptional({
    description: 'LexoRank string of the list after target position',
    example: '0|i00008:',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(({ value }: { value?: string }) => value?.trim())
  nextRank?: string;
}
