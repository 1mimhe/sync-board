import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  Min,
  Max,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

/** DTO for logging time spent on a card. */
export class LogTimeDto {
  @ApiProperty({
    description: 'Minutes spent (1..1440)',
    example: 30,
    minimum: 1,
    maximum: 1440,
  })
  @IsInt()
  @Min(1)
  @Max(1440)
  minutes!: number;

  @ApiPropertyOptional({
    description: 'Optional note',
    maxLength: 500,
    example: 'Code review',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }: { value?: string }) => value?.trim())
  note?: string;
}
