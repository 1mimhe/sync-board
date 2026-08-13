import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * DTO for requesting a password reset email link.
 */
export class ForgotPasswordDto {
  @ApiProperty({
    description: 'Email address to send reset link to',
    example: 'user@example.com',
  })
  @IsEmail()
  @MaxLength(255)
  @Transform(({ value }: { value: string }) => value?.toLowerCase().trim())
  email!: string;
}
