import { JwtPayload } from '../../modules/auth/interfaces/jwt-payload.interface';

/**
 * Custom metadata attached to Socket.IO instances after authentication.
 * Stored in `socket.data` throughout the connection lifecycle.
 */
export interface AuthenticatedSocketData {
  /** Decoded JWT payload */
  user: JwtPayload;
  /** Active board room the socket is subscribed to */
  currentBoardId?: string;
  /** Active workspace room the socket is subscribed to */
  currentWorkspaceId?: string;
}

/**
 * Raw presence data stored in Redis sorted set.
 * Score = timestamp (ms) of last heartbeat/registration.
 * Member = JSON.stringify(PresenceEntry).
 */
export interface PresenceEntry {
  userId: string;
  socketId: string;
  displayName: string;
  avatarUrl: string | null;
  color: string;
  connectedAt: string;
}

/**
 * Presence user payload sent to clients in `board:viewers` and `board:presence` events.
 * Stripped of internal socketId — clients should not see other sockets' IDs.
 */
export interface PresenceUser {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  color: string;
  connectedAt: string;
}

/**
 * WebSocket error event payload emitted to clients.
 * Matches the error format defined in `04-websocket-events.md` § Error Handling.
 */
export interface WsErrorPayload {
  code: string;
  message: string;
  event?: string;
  timestamp: string;
}
