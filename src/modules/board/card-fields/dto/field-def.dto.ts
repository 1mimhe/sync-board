import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Allow,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  IsEnum,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { CardFieldType } from '@prisma/client';

/** DTO for creating a custom field definition. */
export class CreateFieldDefDto {
  @ApiProperty({
    description: 'Field name',
    minLength: 1,
    maxLength: 100,
    example: 'Story Points',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Transform(({ value }: { value: string }) => value?.trim())
  name!: string;

  @ApiProperty({
    description: 'Field type',
    enum: CardFieldType,
    example: 'number',
  })
  @IsEnum(CardFieldType)
  fieldType!: CardFieldType;

  @ApiPropertyOptional({
    description: 'Select options wrapper (for select type, 1..20 options)',
    example: { options: ['Low', 'Medium', 'High'] },
  })
  @IsOptional()
  @Transform(({ value }: { value?: unknown }) => value ?? undefined)
  options?: { options: string[] };

  @ApiPropertyOptional({
    description: 'Whether the field is required',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ description: 'Display position', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}

/** DTO for updating a field definition. */
export class UpdateFieldDefDto {
  @ApiPropertyOptional({
    description: 'Field name',
    minLength: 1,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Transform(({ value }: { value: string }) => value?.trim())
  name?: string;

  @ApiPropertyOptional({
    description: 'Select options (for select type)',
    type: [String],
  })
  @IsOptional()
  options?: { options: string[] };

  @ApiPropertyOptional({ description: 'Whether the field is required' })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ description: 'Display position' })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}

/** DTO for setting a field value on a card. */
export class SetFieldValueDto {
  @ApiProperty({
    description:
      'Field value (type depends on field definition: string | number | ISO date string | select option | user UUID)',
  })
  @Allow()
  value!: unknown;
}
