import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsUUID,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Data transfer object for creating a label (workspace-wide or board-specific).
 */
export class CreateLabelDto {
  @ApiPropertyOptional({
    description: 'Label display name (optional for color-only labels)',
    example: 'Bug',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }: { value?: string }) => value?.trim())
  name?: string;

  @ApiProperty({
    description: 'Label hex color e.g. #EB5A46',
    example: '#EB5A46',
    minLength: 7,
    maxLength: 7,
  })
  @IsString()
  @MinLength(7)
  @MaxLength(7)
  @Transform(({ value }: { value: string }) => value?.trim())
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'color must be a valid 6-character hex color code e.g. #EB5A46',
  })
  color!: string;

  @ApiPropertyOptional({
    description:
      'Optional card UUID to immediately attach newly created label to',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('4')
  cardId?: string;
}
