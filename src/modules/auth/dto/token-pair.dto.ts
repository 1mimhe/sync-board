import { ApiProperty } from '@nestjs/swagger';

/**
 * Data transfer object for access token HTTP response body.
 * The refresh token is set exclusively via HTTP-only cookie and omitted from the response body.
 */
export class TokenResponseDto {
  @ApiProperty({
    description: 'Signed JWT access token (15m validity)',
    example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken!: string;

  @ApiProperty({
    description: 'Access token expiration time in seconds',
    example: 900,
  })
  expiresIn!: number;
}

/**
 * Alias for TokenResponseDto for backward compatibility across imports.
 */
export class TokenPairDto extends TokenResponseDto {}
