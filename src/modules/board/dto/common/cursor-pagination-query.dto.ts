import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

/**
 * Standard query parameters for cursor-based pagination (project standard).
 */
export class CursorPaginationQueryDto {
  /** Cursor: last item's id from the previous page */
  @ApiPropertyOptional({
    description: "Cursor: last item's id from the previous page",
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID('4')
  cursor?: string;

  /** Items per page */
  @ApiPropertyOptional({
    description: 'Items per page',
    example: 20,
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
