import { SetMetadata, CustomDecorator } from '@nestjs/common';
import { WsRateLimitCategory } from 'src/modules/board/board.constants';

export const WS_RATE_LIMIT_KEY = 'ws_rate_limit';

export interface WsRateLimitOptions {
  category: WsRateLimitCategory;
  limit: number;
  windowMs: number;
  silent?: boolean;
}

/**
 * Decorator to apply rate limiting configuration to a WebSocket event handler.
 * Evaluated by `WsRateLimitGuard`.
 *
 * @example
 * // Using configuration constant object:
 * @WsRateLimit(WS_RATE_LIMITS.ROOM_JOINS)
 * @SubscribeMessage(WS_EVENTS.WORKSPACE_JOIN)
 * handleWorkspaceJoin(...) {}
 *
 * @example
 * // Using individual parameters:
 * @WsRateLimit('cursor', 20, 1000, true)
 * @SubscribeMessage(WS_EVENTS.PRESENCE_CURSOR)
 * handleCursor(...) {}
 */
export function WsRateLimit(
  config: WsRateLimitOptions,
): CustomDecorator<string>;
export function WsRateLimit(
  category: string,
  limit: number,
  windowMs: number,
  silent?: boolean,
): CustomDecorator<string>;
export function WsRateLimit(
  configOrCategory: WsRateLimitOptions | string,
  limit?: number,
  windowMs?: number,
  silent = false,
): CustomDecorator<string> {
  if (typeof configOrCategory === 'object') {
    return SetMetadata(WS_RATE_LIMIT_KEY, configOrCategory);
  }
  return SetMetadata(WS_RATE_LIMIT_KEY, {
    category: configOrCategory,
    limit: limit ?? 60,
    windowMs: windowMs ?? 60_000,
    silent,
  });
}
