import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { WorkspaceRole } from '@prisma/client';

export class UpdateMemberRoleDto {
  @ApiProperty({
    description: 'Updated workspace role',
    enum: WorkspaceRole,
    example: WorkspaceRole.admin,
  })
  @IsEnum(WorkspaceRole)
  role!: WorkspaceRole;
}
