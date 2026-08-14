import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateCardDto } from './create-card.dto';

/**
 * Data transfer object for updating card fields and completion status.
 */
export class UpdateCardDto extends PartialType(CreateCardDto) {
  @ApiPropertyOptional({
    description: 'Completion status of card',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isComplete?: boolean;
}
