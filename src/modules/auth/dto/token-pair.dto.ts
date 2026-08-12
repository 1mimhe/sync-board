import { ApiProperty } from '@nestjs/swagger';
import type { TokenPair } from '../interfaces/auth-response.interface';

/**
 * Data transfer object for JWT access token and raw refresh token pair response.
 */
export class TokenPairDto implements TokenPair {
  @ApiProperty({
    description: 'Signed JWT access token (15m validity)',
    example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken!: string;

  @ApiProperty({
    description: 'Cryptographically strong raw refresh token (7d validity)',
    example: 'dGhpcyBpcyBhIHJhbmRvbSByZWZyZXNoIHRva2Vu',
  })
  refreshToken!: string;

  @ApiProperty({
    description: 'Access token expiration time in seconds',
    example: 900,
  })
  expiresIn!: number;
}
