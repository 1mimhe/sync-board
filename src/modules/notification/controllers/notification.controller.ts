import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import type { PaginatedResult } from '../../../common/interfaces/pagination.interface';
import { NotificationService } from '../services/notification.service';
import { NotificationListQueryDto } from '../dto/notification-query.dto';
import {
  NotificationResponseDto,
  PaginatedNotificationResponseDto,
} from '../dto/notification-response.dto';

/** User-scoped notification inbox. All routes require JWT auth. */
@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /** Lists the caller's notifications newest-first. */
  @Get()
  @ApiOperation({ summary: "List caller's notifications" })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'unreadOnly', required: false, type: Boolean })
  @ApiOkResponse({
    type: PaginatedNotificationResponseDto,
    description: 'Paginated list of user notifications',
  })
  async list(
    @CurrentUser() user: JwtPayload,
    @Query() query: NotificationListQueryDto,
  ): Promise<PaginatedResult<NotificationResponseDto>> {
    return this.notificationService.listForUser(user.sub, query);
  }

  /** Returns the caller's unread count (Redis fast-path with DB fallback). */
  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiOkResponse({
    description: 'Unread count',
    schema: { example: { count: 3 } },
  })
  async unreadCount(
    @CurrentUser() user: JwtPayload,
  ): Promise<{ count: number }> {
    return { count: await this.notificationService.getUnreadCount(user.sub) };
  }

  /** Marks all of the caller's notifications as read. */
  @Post('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiNoContentResponse({ description: 'All notifications marked as read' })
  async markAllRead(@CurrentUser() user: JwtPayload): Promise<void> {
    await this.notificationService.markAllRead(user.sub);
  }

  /** Marks one owned notification as read. */
  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiOkResponse({ type: NotificationResponseDto })
  async markRead(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<NotificationResponseDto> {
    return this.notificationService.markRead(user.sub, id);
  }
}
