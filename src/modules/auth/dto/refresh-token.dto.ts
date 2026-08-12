import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * DTO for token refresh rotation request.
 * Optional if token is sent via httpOnly cookie.
 */
export class RefreshTokenDto {
  @ApiPropertyOptional({
    description:
      'Current refresh token (optional if provided via httpOnly cookie)',
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
