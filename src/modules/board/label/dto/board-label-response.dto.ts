import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Response DTO representing label details (workspace-level or board-specific).
 */
export class LabelResponseDto {
  @ApiProperty({
    description: 'Label UUID',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  id!: string;

  @ApiProperty({
    description: 'Workspace UUID',
    example: 'w0eebc99-9c0b-4ef8-bb6d-6bb9bd380a00',
  })
  workspaceId!: string;

  @ApiPropertyOptional({
    description: 'Board UUID (null for shared workspace-level labels)',
    example: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    nullable: true,
  })
  boardId?: string | null;

  @ApiPropertyOptional({
    description: 'Label name',
    example: 'Bug',
    nullable: true,
  })
  name!: string | null;

  @ApiProperty({
    description: 'Label hex color code',
    example: '#EB5A46',
  })
  color!: string;

  @ApiPropertyOptional({
    description: 'Creation timestamp',
  })
  createdAt?: Date;
}

/**
 * Backward compatibility alias for LabelResponseDto.
 */
export { LabelResponseDto as BoardLabelResponseDto };
