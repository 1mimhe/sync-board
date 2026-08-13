import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkspaceRole } from '@prisma/client';

export class MemberUserSummaryDto {
  @ApiProperty({
    description: 'User UUID',
    example: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  })
  id!: string;

  @ApiProperty({
    description: 'User display name',
    example: 'John Doe',
  })
  displayName!: string;

  @ApiProperty({
    description: 'User email address',
    example: 'john.doe@example.com',
  })
  email!: string;

  @ApiPropertyOptional({
    description: 'User avatar URL',
    example: 'https://example.com/avatar.jpg',
    nullable: true,
  })
  avatarUrl!: string | null;
}

export class WorkspaceMemberResponseDto {
  @ApiProperty({
    description: 'Workspace member record UUID',
    example: 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
  })
  id!: string;

  @ApiProperty({
    description: 'Workspace UUID',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  workspaceId!: string;

  @ApiProperty({
    description: 'Member user UUID',
    example: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  })
  userId!: string;

  @ApiProperty({
    description: 'Role of the member in the workspace',
    enum: WorkspaceRole,
    example: WorkspaceRole.member,
  })
  role!: WorkspaceRole;

  @ApiProperty({
    description: 'Timestamp when user joined the workspace',
    example: '2026-08-12T12:00:00.000Z',
  })
  joinedAt!: Date;
}

export class MemberWithUserResponseDto extends WorkspaceMemberResponseDto {
  @ApiProperty({
    description: 'User details summary',
    type: MemberUserSummaryDto,
  })
  user!: MemberUserSummaryDto;
}
