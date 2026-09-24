import type { WsRateLimitCategory } from '../constants/ws-rate-limit.constants';

/** Configuration accepted by `@WsRateLimit()`. */
export interface WsRateLimitOptions {
  category: WsRateLimitCategory;
  limit: number;
  windowMs: number;
  silent?: boolean;
}
