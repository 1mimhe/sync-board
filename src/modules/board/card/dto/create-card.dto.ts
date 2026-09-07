import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { CardPriority, CardStatus } from '@prisma/client';
import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsDateString,
  IsArray,
  IsUUID,
  IsObject,
  IsInt,
  Min,
  Max,
  IsEnum,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Data transfer object for creating a new card in a list.
 */
export class CreateCardDto {
  @ApiProperty({
    description: 'Card title',
    example: 'Implement auth refresh token rotation',
    minLength: 1,
    maxLength: 500,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  @Transform(({ value }: { value: string }) => value?.trim())
  title!: string;

  @ApiPropertyOptional({
    description: 'Card description as Tiptap JSON or text',
    example: { type: 'doc', content: [] },
  })
  @IsOptional()
  @IsObject()
  description?: Prisma.InputJsonValue;

  @ApiPropertyOptional({
    description: 'Due date in ISO 8601 format',
    example: '2026-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({
    description: 'Cover image URL',
    example: 'https://cdn.example.com/cover.png',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }: { value?: string }) => value?.trim())
  coverImageUrl?: string;

  @ApiPropertyOptional({
    description: 'User IDs to assign',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  assigneeIds?: string[];

  @ApiPropertyOptional({
    description: 'Label IDs to attach',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  labelIds?: string[];

  @ApiPropertyOptional({
    description: 'Priority stage',
    enum: CardPriority,
    example: 'medium',
  })
  @IsOptional()
  @IsEnum(CardPriority)
  priority?: CardPriority;

  @ApiPropertyOptional({
    description: 'Status',
    enum: CardStatus,
    example: 'not_started',
  })
  @IsOptional()
  @IsEnum(CardStatus)
  status?: CardStatus;

  @ApiPropertyOptional({
    description: 'Parent card ID (for subcard)',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('4')
  parentCardId?: string;

  @ApiPropertyOptional({
    description: 'Estimated minutes',
    example: 120,
    minimum: 0,
    maximum: 100000,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  estimateMinutes?: number;
}
