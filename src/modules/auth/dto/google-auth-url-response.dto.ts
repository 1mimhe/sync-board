import { ApiProperty } from '@nestjs/swagger';

/**
 * Response payload containing the Google OAuth authorization URL.
 */
export class GoogleAuthUrlResponseDto {
  @ApiProperty({
    description: 'Google OAuth 2.0 authorization URL for client redirection',
    example: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=...',
  })
  url!: string;
}
