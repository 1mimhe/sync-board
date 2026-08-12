import { ApiProperty } from '@nestjs/swagger';

/**
 * Generic status message response DTO.
 */
export class MessageResponseDto {
  @ApiProperty({
    description: 'Human-readable status or informational message',
    example: 'Operation completed successfully.',
  })
  message!: string;
}
