import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNotEmpty } from 'class-validator';

export class TransferOwnershipDto {
  @ApiProperty({
    description: 'The User ID of the member to transfer ownership to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsUUID()
  newOwnerId!: string;
}
