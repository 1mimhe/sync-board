import { SetMetadata, CustomDecorator } from '@nestjs/common';
import {
  WS_RATE_LIMIT_DEFAULTS,
  WS_RATE_LIMIT_KEY,
} from '../constants/ws-rate-limit.constants';
import type { WsRateLimitOptions } from './ws-rate-limit.interface';

/**
 * Applies rate limiting configuration to a WebSocket event handler.
 *
 * @param config - Rate limit options or positional category, limit, window, and silent flag.
 * @returns Parameter decorator storing the configuration as metadata.
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
    limit: limit ?? WS_RATE_LIMIT_DEFAULTS.limit,
    windowMs: windowMs ?? WS_RATE_LIMIT_DEFAULTS.windowMs,
    silent,
  });
}
