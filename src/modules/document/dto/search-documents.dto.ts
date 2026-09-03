import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length } from 'class-validator';
import { CursorPaginationQueryDto } from '../../../common/dto/cursor-pagination-query.dto';

/** Query parameters for listing and full-text searching workspace documents. */
export class SearchDocumentsDto extends CursorPaginationQueryDto {
  /** Full-text search term matched against the document preview text */
  @ApiPropertyOptional({
    description: 'Full-text search over document content (preview text)',
    example: 'authentication',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Length(0, 200)
  search?: string;
}
