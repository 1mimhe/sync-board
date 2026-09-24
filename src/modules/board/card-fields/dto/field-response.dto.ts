import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CardFieldType } from '@prisma/client';

/**
 * Response DTO representing a workspace custom field definition.
 */
export class CardFieldDefResponseDto {
  @ApiProperty({ description: 'Field definition UUID' })
  id!: string;

  @ApiProperty({ description: 'Owning workspace UUID' })
  workspaceId!: string;

  @ApiProperty({ description: 'Field name', example: 'Priority' })
  name!: string;

  @ApiProperty({
    description: 'Field value type',
    enum: CardFieldType,
  })
  fieldType!: CardFieldType;

  @ApiPropertyOptional({ description: 'Select options (select fields only)' })
  options?: unknown;

  @ApiProperty({ description: 'Whether a value is required' })
  required!: boolean;

  @ApiProperty({ description: 'Display position' })
  position!: number;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: Date;
}

/**
 * Response DTO representing a custom field value on a card.
 */
export class CardFieldValueResponseDto {
  @ApiProperty({ description: 'Field value UUID' })
  id!: string;

  @ApiProperty({ description: 'Field definition UUID' })
  fieldId!: string;

  @ApiProperty({ description: 'Card UUID' })
  cardId!: string;

  @ApiProperty({ description: 'Stored value (type depends on the field)' })
  value!: unknown;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Update timestamp' })
  updatedAt!: Date;
}

/**
 * Response DTO for a card field value with its definition included.
 */
export class CardFieldValueWithDefResponseDto extends CardFieldValueResponseDto {
  @ApiProperty({
    description: 'Field definition',
    type: CardFieldDefResponseDto,
  })
  field!: CardFieldDefResponseDto;
}
