import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Data transfer object for creating a checklist on a card.
 */
export class CreateChecklistDto {
  /** Checklist title */
  @ApiProperty({
    description: 'Checklist title',
    example: 'Definition of Done',
    minLength: 1,
    maxLength: 200,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Transform(({ value }: { value: string }) => value?.trim())
  title!: string;
}
