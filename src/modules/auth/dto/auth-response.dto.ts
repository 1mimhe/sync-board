import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from './user-response.dto';
import { TokenResponseDto } from './token-pair.dto';

/**
 * Standard authentication response payload containing user profile metadata and access token info.
 */
export class AuthResponseDto {
  @ApiProperty({
    type: UserResponseDto,
    description: 'Authenticated user profile info',
  })
  user!: UserResponseDto;

  @ApiProperty({
    type: TokenResponseDto,
    description: 'Issued access token and expiration details',
  })
  tokens!: TokenResponseDto;
}
