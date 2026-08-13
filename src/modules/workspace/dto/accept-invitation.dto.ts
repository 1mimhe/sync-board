import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class AcceptInvitationDto {
  @ApiProperty({
    description: 'Unique invitation token',
    example: 'inv_a1b2c3d4e5f67890',
  })
  @IsString()
  @MaxLength(255)
  @Transform(({ value }: { value: string }) => value?.trim())
  token!: string;
}
