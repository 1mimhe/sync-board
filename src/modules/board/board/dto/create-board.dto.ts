import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Data transfer object for creating a new board in a workspace.
 */
export class CreateBoardDto {
  @ApiProperty({
    description: 'Board title',
    example: 'Sprint Planning',
    minLength: 1,
    maxLength: 200,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Transform(({ value }: { value: string }) => value?.trim())
  title!: string;

  @ApiPropertyOptional({
    description: 'Board description',
    example: 'Board for Q3 product delivery',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(({ value }: { value?: string }) => value?.trim())
  description?: string;

  @ApiPropertyOptional({
    description: 'Board background hex color (e.g. #1A1A2E)',
    example: '#1A1A2E',
    minLength: 7,
    maxLength: 7,
  })
  @IsOptional()
  @IsString()
  @MinLength(7)
  @MaxLength(7)
  @Transform(({ value }: { value?: string }) => value?.trim())
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'backgroundColor must be a valid hex color e.g. #1A1A2E',
  })
  backgroundColor?: string;
}
