import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength, MaxLength, IsUrl } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * DTO for updating user profile attributes.
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({ description: 'Display name', minLength: 2, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Transform(({ value }: { value: string }) => value?.trim())
  displayName?: string;

  @ApiPropertyOptional({ description: 'Avatar image URL' })
  @IsOptional()
  @IsUrl()
  @MaxLength(2000)
  avatarUrl?: string;
}
