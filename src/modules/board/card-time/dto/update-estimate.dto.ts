import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min, Max } from 'class-validator';

/** DTO for setting a card's time estimate. */
export class UpdateEstimateDto {
  @ApiProperty({
    description: 'Estimated minutes',
    example: 120,
    minimum: 0,
    maximum: 100000,
  })
  @IsInt()
  @Min(0)
  @Max(100000)
  estimateMinutes!: number;
}
