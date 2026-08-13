import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from './user-response.dto';
import { TokenPairDto } from './token-pair.dto';
import type { AuthResponse } from '../interfaces/auth-response.interface';

/**
 * Standard authentication response payload containing user profile metadata and token pair.
 */
export class AuthResponseDto implements AuthResponse {
  @ApiProperty({
    type: UserResponseDto,
    description: 'Authenticated user profile info',
  })
  user!: UserResponseDto;

  @ApiProperty({
    type: TokenPairDto,
    description: 'Issued Access and Refresh token pair',
  })
  tokens!: TokenPairDto;
}
