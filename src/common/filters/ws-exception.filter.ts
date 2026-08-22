import { Catch, ArgumentsHost, Logger } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import type { WsErrorPayload } from '../interfaces/ws.interface';

/**
 * Global WebSocket exception filter.
 * Catches all WsException and unhandled errors in WebSocket gateways,
 * emitting a structured error payload to the originating client.
 */
@Catch()
export class WsExceptionFilter extends BaseWsExceptionFilter {
  private readonly logger = new Logger(WsExceptionFilter.name);

  override catch(exception: unknown, host: ArgumentsHost): void {
    const client = host.switchToWs().getClient<Socket>();

    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';
    let event: string | undefined;

    if (exception instanceof WsException) {
      const error = exception.getError();
      if (typeof error === 'object' && error !== null) {
        const errObj = error as Record<string, unknown>;
        code = (errObj['code'] as string) || code;
        message = (errObj['message'] as string) || message;
        event = errObj['event'] as string | undefined;
      } else if (typeof error === 'string') {
        message = error;
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `Unhandled WebSocket exception: ${exception.message}`,
        exception.stack,
        { socketId: client?.id },
      );
    }

    const payload: WsErrorPayload = {
      code,
      message,
      ...(event ? { event } : {}),
      timestamp: new Date().toISOString(),
    };

    if (client && typeof client.emit === 'function') {
      client.emit('error', payload);
    }
  }
}
