import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Data transfer object representing sanitized user profile details.
 */
export class UserResponseDto {
  @ApiProperty({
    description: 'Unique user identifier (UUID v4)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  email!: string;

  @ApiProperty({
    description: 'Display name of the user',
    example: 'Jane Doe',
  })
  displayName!: string;

  @ApiPropertyOptional({
    description: 'Avatar image URL if uploaded or provided by OAuth',
    nullable: true,
    example: 'https://example.com/avatar.jpg',
  })
  avatarUrl!: string | null;

  @ApiProperty({
    description: 'Whether the user email address is verified',
    example: false,
  })
  isEmailVerified!: boolean;

  @ApiProperty({
    description: 'User account creation timestamp',
    example: '2026-01-01T00:00:00.000Z',
  })
  createdAt!: Date;

  @ApiPropertyOptional({
    description: 'User account last updated timestamp',
    example: '2026-01-01T00:00:00.000Z',
  })
  updatedAt?: Date;
}
