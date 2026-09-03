import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Data transfer object for updating a checklist item (edit content and/or toggle done).
 */
export class UpdateChecklistItemDto {
  /** New item content text */
  @ApiPropertyOptional({
    description: 'New item content',
    example: 'Code reviewed by at least one senior developer',
    minLength: 1,
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  content?: string;

  /** Completion state */
  @ApiPropertyOptional({ description: 'Completion state', example: true })
  @IsOptional()
  @IsBoolean()
  isDone?: boolean;
}
