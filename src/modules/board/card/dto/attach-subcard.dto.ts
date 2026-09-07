import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

/** DTO for attaching an existing card as a subcard. */
export class AttachSubcardDto {
  @ApiProperty({ description: 'Subcard UUID to attach', format: 'uuid' })
  @IsUUID('4')
  subcardId!: string;
}
