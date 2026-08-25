/**
 * Payload sent by client to join a workspace room.
 */
export interface WorkspaceJoinPayload {
  workspaceId: string;
}

/**
 * Payload sent by client to leave a workspace room.
 */
export interface WorkspaceLeavePayload {
  workspaceId: string;
}

/**
 * Payload sent by client to join a board room.
 */
export interface BoardJoinPayload {
  boardId: string;
}

/**
 * Payload sent by client to leave a board room.
 */
export interface BoardLeavePayload {
  boardId: string;
}

/**
 * Payload sent by client for cursor position streaming.
 */
export interface CursorPayload {
  boardId: string;
  cardId?: string;
  x: number;
  y: number;
}

/**
 * Cursor broadcast payload delivered to other viewers on the board.
 */
export interface CursorBroadcast {
  userId: string;
  displayName: string;
  color: string;
  x: number;
  y: number;
  cardId?: string;
}

/**
 * Presence action broadcast payload.
 */
export interface PresenceBroadcast {
  userId: string;
  action: 'joined' | 'left';
  displayName: string;
  avatarUrl: string | null;
  color?: string;
}
