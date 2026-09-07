import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { CardStatus } from '@prisma/client';

/** DTO for moving a card through the 4-state workflow. */
export class UpdateCardStatusDto {
  @ApiProperty({
    description: 'New status',
    enum: CardStatus,
    example: 'active',
  })
  @IsEnum(CardStatus)
  status!: CardStatus;
}
