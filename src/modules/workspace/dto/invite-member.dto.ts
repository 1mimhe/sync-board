import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { WorkspaceRole } from '@prisma/client';

export class InviteMemberDto {
  @ApiProperty({
    description: 'Email address of the invitee',
    example: 'colleague@example.com',
  })
  @IsEmail()
  @MaxLength(255)
  @Transform(({ value }: { value: string }) => value?.toLowerCase().trim())
  email!: string;

  @ApiProperty({
    description: 'Target workspace role',
    enum: WorkspaceRole,
    default: WorkspaceRole.member,
  })
  @IsEnum(WorkspaceRole)
  role!: WorkspaceRole;
}
