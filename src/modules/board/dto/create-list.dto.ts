import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Data transfer object for creating a new list on a board.
 */
export class CreateListDto {
  @ApiProperty({
    description: 'List title',
    example: 'In Progress',
    minLength: 1,
    maxLength: 200,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Transform(({ value }: { value: string }) => value?.trim())
  title!: string;
}
