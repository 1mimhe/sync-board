import { UseFilters } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server } from 'socket.io';
import type { Notification } from '@prisma/client';
import { WsExceptionFilter } from '../../common/filters/ws-exception.filter';

@UseFilters(new WsExceptionFilter())
@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class NotificationPushGateway {
  @WebSocketServer() private server!: Server;

  /**
   * Pushes one notification + a count-stale hint to the user's private room
   * (joined on connect as `user:{userId}`).
   *
   * @param userId - Recipient user UUID
   * @param notification - Persisted notification row
   */
  emitToUser(userId: string, notification: Notification): void {
    this.server?.to(`user:${userId}`).emit('notification:new', notification);
    // -1 sentinel: count changed, client refetches GET /notifications/unread-count.
    this.server
      ?.to(`user:${userId}`)
      .emit('notification:count', { unreadCount: -1 });
  }
}
