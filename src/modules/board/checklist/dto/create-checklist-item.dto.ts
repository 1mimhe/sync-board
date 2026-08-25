import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Data transfer object for adding an item to a checklist.
 */
export class CreateChecklistItemDto {
  /** Item content text */
  @ApiProperty({
    description: 'Checklist item content',
    example: 'Code reviewed by two developers',
    minLength: 1,
    maxLength: 500,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  @Transform(({ value }: { value: string }) => value?.trim())
  content!: string;
}
