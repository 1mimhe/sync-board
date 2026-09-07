import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { CardPriority } from '@prisma/client';

/** DTO for changing a card's named priority stage. */
export class UpdateCardPriorityDto {
  @ApiProperty({
    description: 'New priority stage',
    enum: CardPriority,
    example: 'high',
  })
  @IsEnum(CardPriority)
  priority!: CardPriority;
}
