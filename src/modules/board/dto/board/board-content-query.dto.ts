import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Query parameters for paginating lists and cards when fetching full board content.
 */
export class BoardContentQueryDto {
  @ApiPropertyOptional({
    description: 'Page of lists to load (1-based)',
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  listPage?: number;

  @ApiPropertyOptional({
    description: 'Number of lists per page',
    example: 50,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  listPageSize?: number;

  @ApiPropertyOptional({
    description:
      'Number of cards to load per list (cards are paginated per list)',
    example: 50,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  cardPageSize?: number;
}
