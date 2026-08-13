import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkspaceRole } from '@prisma/client';

export class WorkspaceResponseDto {
  @ApiProperty({
    description: 'Unique workspace UUID',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  id!: string;

  @ApiProperty({
    description: 'Workspace display name',
    example: 'Acme Corp',
  })
  name!: string;

  @ApiProperty({
    description: 'Unique URL-friendly slug',
    example: 'acme-corp',
  })
  slug!: string;

  @ApiPropertyOptional({
    description: 'Workspace description',
    example: 'Workspace for main engineering projects',
    nullable: true,
  })
  description!: string | null;

  @ApiProperty({
    description: 'Owner user UUID',
    example: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  })
  ownerId!: string;

  @ApiProperty({
    description: 'Workspace creation timestamp',
    example: '2026-08-12T12:00:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Workspace update timestamp',
    example: '2026-08-12T12:00:00.000Z',
  })
  updatedAt!: Date;

  @ApiPropertyOptional({
    description: 'Timestamp when the workspace was archived',
    example: null,
    nullable: true,
  })
  archivedAt!: Date | null;
}

export class WorkspaceWithRoleResponseDto extends WorkspaceResponseDto {
  @ApiProperty({
    description: 'Role of the requesting user in the workspace',
    enum: WorkspaceRole,
    example: WorkspaceRole.owner,
  })
  role!: WorkspaceRole;
}
