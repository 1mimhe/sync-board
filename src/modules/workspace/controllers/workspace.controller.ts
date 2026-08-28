import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Workspace, WorkspaceMember } from '@prisma/client';
import { WorkspaceService } from '../services/workspace.service';
import { MembershipService } from '../services/membership.service';
import { InvitationService } from '../services/invitation.service';
import {
  CreateWorkspaceDto,
  UpdateWorkspaceDto,
  InviteMemberDto,
  UpdateMemberRoleDto,
  AcceptInvitationDto,
  TransferOwnershipDto,
  WorkspaceResponseDto,
  WorkspaceWithRoleResponseDto,
  WorkspaceMemberResponseDto,
  MemberWithUserResponseDto,
  WorkspaceInvitationResponseDto,
  CursorPaginationQueryDto,
} from '../dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../../../common/guards/email-verified.guard';
import { SkipEmailVerification } from '../../../common/decorators/skip-email-verification.decorator';
import { WorkspaceAuth } from '../decorators/workspace-auth.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import type { PaginatedResult } from '../../../common/interfaces/pagination.interface';
import {
  WorkspaceWithRole,
  MemberWithUser,
  WorkspaceInvitationWithInviter,
} from '../interfaces/workspace.interfaces';

@ApiTags('Workspaces')
@Controller('workspaces')
export class WorkspaceController {
  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly membershipService: MembershipService,
    private readonly invitationService: InvitationService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new workspace' })
  @ApiCreatedResponse({
    type: WorkspaceResponseDto,
    description: 'Workspace created successfully',
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden — email not verified (EMAIL_NOT_VERIFIED) or already authenticated',
  })
  async create(
    @Body() dto: CreateWorkspaceDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<Workspace> {
    return this.workspaceService.create(dto, user.sub);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List workspaces for current user (paginated)' })
  @ApiOkResponse({
    type: [WorkspaceWithRoleResponseDto],
    description: 'Paginated list of workspaces: { items, pagination }',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async listMine(
    @CurrentUser() user: JwtPayload,
    @Query() query: CursorPaginationQueryDto,
  ): Promise<PaginatedResult<WorkspaceWithRole>> {
    return this.workspaceService.findAllForUser(user.sub, query);
  }

  /**
   * CRITICAL ROUTE ORDERING: `GET slug/:slug` MUST be declared BEFORE `GET :workspaceId`.
   * Otherwise NestJS pattern matching treats 'slug' as a `:workspaceId` UUID parameter
   * and fails route resolution.
   */
  @Get('slug/:slug')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get workspace details by unique slug (members only)',
  })
  @ApiOkResponse({
    type: WorkspaceWithRoleResponseDto,
    description: 'Workspace details',
  })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  @ApiResponse({ status: 403, description: 'Not a member of this workspace' })
  async getBySlug(
    @Param('slug') slug: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<WorkspaceWithRole> {
    return this.workspaceService.findBySlug(slug, user.sub);
  }

  @Post('invitations/accept')
  @UseGuards(JwtAuthGuard)
  @SkipEmailVerification()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Accept a workspace invitation using token' })
  @ApiOkResponse({
    type: WorkspaceMemberResponseDto,
    description: 'Joined workspace successfully',
  })
  @ApiResponse({ status: 422, description: 'Invitation invalid or expired' })
  async acceptInvitation(
    @Body() dto: AcceptInvitationDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<WorkspaceMember> {
    return this.invitationService.acceptInvitation(dto, user.sub);
  }

  @Get(':workspaceId')
  @WorkspaceAuth('owner', 'admin', 'member', 'viewer')
  @ApiOperation({ summary: 'Get workspace details by ID' })
  @ApiOkResponse({
    type: WorkspaceWithRoleResponseDto,
    description: 'Workspace details including requesting user role',
  })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async getById(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<WorkspaceWithRole> {
    return this.workspaceService.findByIdWithRole(workspaceId, user.sub);
  }

  @Patch(':workspaceId')
  @WorkspaceAuth('owner', 'admin')
  @ApiOperation({ summary: 'Update workspace information' })
  @ApiOkResponse({
    type: WorkspaceResponseDto,
    description: 'Workspace updated successfully',
  })
  async update(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: UpdateWorkspaceDto,
  ): Promise<Workspace> {
    return this.workspaceService.update(workspaceId, dto);
  }

  @Delete(':workspaceId')
  @WorkspaceAuth('owner')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Archive a workspace (owner only)' })
  @ApiNoContentResponse({ description: 'Workspace archived' })
  async archive(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ): Promise<void> {
    await this.workspaceService.archive(workspaceId);
  }

  @Delete(':workspaceId/leave')
  @WorkspaceAuth('owner', 'admin', 'member', 'viewer')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Leave a workspace (self-remove)' })
  @ApiNoContentResponse({ description: 'Successfully left workspace' })
  @ApiResponse({
    status: 422,
    description: 'Sole owner must transfer ownership before leaving',
  })
  async leaveWorkspace(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.membershipService.leaveWorkspace(workspaceId, user.sub);
  }

  @Post(':workspaceId/transfer-ownership')
  @WorkspaceAuth('owner')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Transfer workspace ownership to another member' })
  @ApiOkResponse({
    type: WorkspaceMemberResponseDto,
    description: 'Ownership transferred successfully',
  })
  async transferOwnership(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: TransferOwnershipDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<WorkspaceMember> {
    return this.membershipService.transferOwnership(
      workspaceId,
      user.sub,
      dto.newOwnerId,
    );
  }

  @Get(':workspaceId/members')
  @WorkspaceAuth('owner', 'admin', 'member', 'viewer')
  @ApiOperation({ summary: 'List workspace members with user details' })
  @ApiOkResponse({
    type: [MemberWithUserResponseDto],
    description: 'List of members',
  })
  async getMembers(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ): Promise<MemberWithUser[]> {
    return this.membershipService.getMembers(workspaceId);
  }

  @Patch(':workspaceId/members/:memberId')
  @WorkspaceAuth('owner', 'admin')
  @ApiOperation({ summary: 'Update member role' })
  @ApiOkResponse({
    type: WorkspaceMemberResponseDto,
    description: 'Member role updated',
  })
  @ApiResponse({ status: 422, description: 'Cannot remove sole owner' })
  async updateMemberRole(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: UpdateMemberRoleDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<WorkspaceMember> {
    return this.membershipService.updateMemberRole(
      workspaceId,
      memberId,
      dto,
      user.sub,
    );
  }

  @Delete(':workspaceId/members/:memberId')
  @WorkspaceAuth('owner', 'admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove member from workspace' })
  @ApiNoContentResponse({ description: 'Member removed' })
  @ApiResponse({ status: 422, description: 'Cannot remove sole owner' })
  async removeMember(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.membershipService.removeMember(workspaceId, memberId, user.sub);
  }

  @Post(':workspaceId/invitations')
  @WorkspaceAuth('owner', 'admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send an invitation to join the workspace' })
  @ApiCreatedResponse({
    type: WorkspaceInvitationResponseDto,
    description: 'Invitation created and sent',
  })
  @ApiResponse({
    status: 422,
    description: 'User already a member or invite pending',
  })
  async inviteMember(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: InviteMemberDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<WorkspaceInvitationWithInviter> {
    return this.invitationService.inviteMember(workspaceId, dto, user.sub);
  }

  @Get(':workspaceId/invitations')
  @WorkspaceAuth('owner', 'admin')
  @ApiOperation({ summary: 'List pending workspace invitations' })
  @ApiOkResponse({
    type: [WorkspaceInvitationResponseDto],
    description: 'List of pending invitations',
  })
  async getInvitations(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ): Promise<WorkspaceInvitationWithInviter[]> {
    return this.invitationService.getInvitations(workspaceId);
  }

  @Delete(':workspaceId/invitations/:invitationId')
  @WorkspaceAuth('owner', 'admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a pending workspace invitation' })
  @ApiNoContentResponse({ description: 'Invitation revoked' })
  async revokeInvitation(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ): Promise<void> {
    await this.invitationService.revokeInvitation(workspaceId, invitationId);
  }
}
