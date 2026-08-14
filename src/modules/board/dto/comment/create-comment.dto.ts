import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Data transfer object for adding a comment to a card.
 */
export class CreateCommentDto {
  @ApiProperty({
    description: 'Comment content',
    example: 'I updated the PR with requested changes.',
    minLength: 1,
    maxLength: 5000,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  @Transform(({ value }: { value: string }) => value?.trim())
  content!: string;
}
