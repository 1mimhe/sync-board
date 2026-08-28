import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * DTO for verifying an email address with a single-use token.
 */
export class VerifyEmailDto {
  @ApiProperty({
    description: 'Raw email verification token from the verification link',
    example: 'aJ4x_9fQ2pT...',
  })
  @IsString()
  @MinLength(10)
  @MaxLength(255)
  token!: string;
}
