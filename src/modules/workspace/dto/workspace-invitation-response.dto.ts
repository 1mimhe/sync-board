import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InvitationStatus, WorkspaceRole } from '@prisma/client';
import { MemberUserSummaryDto } from './workspace-member-response.dto';

export class WorkspaceInvitationResponseDto {
  @ApiProperty({
    description: 'Invitation UUID',
    example: 'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
  })
  id!: string;

  @ApiProperty({
    description: 'Workspace UUID',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  workspaceId!: string;

  @ApiProperty({
    description: 'Invited recipient email address',
    example: 'invitee@example.com',
  })
  email!: string;

  @ApiProperty({
    description: 'Role to be granted upon joining',
    enum: WorkspaceRole,
    example: WorkspaceRole.member,
  })
  role!: WorkspaceRole;

  @ApiProperty({
    description: 'Unique invitation token',
    example: 'e4a8f9c2d1b0a9f8e7d6c5b4a3f2e1d0',
  })
  token!: string;

  @ApiProperty({
    description: 'User UUID of the inviter',
    example: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  })
  invitedBy!: string;

  @ApiProperty({
    description: 'Status of the invitation',
    enum: InvitationStatus,
    example: InvitationStatus.pending,
  })
  status!: InvitationStatus;

  @ApiProperty({
    description: 'Timestamp when invitation expires',
    example: '2026-08-19T12:00:00.000Z',
  })
  expiresAt!: Date;

  @ApiProperty({
    description: 'Timestamp when invitation was created',
    example: '2026-08-12T12:00:00.000Z',
  })
  createdAt!: Date;

  @ApiPropertyOptional({
    description: 'Timestamp when invitation was accepted',
    example: null,
    nullable: true,
  })
  acceptedAt!: Date | null;

  @ApiProperty({
    description: 'Inviter user summary details',
    type: MemberUserSummaryDto,
  })
  inviter!: MemberUserSummaryDto;
}
