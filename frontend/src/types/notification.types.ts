export type NotificationType =
  | 'card_assigned'
  | 'comment_added'
  | 'comment_mentioned'
  | 'card_status_changed'
  | 'card_priority_changed'
  | 'card_linked'
  | 'workspace_invited'
  | 'workspace_role_changed';

export interface Notification {
  id: string;
  userId: string;
  workspaceId: string;
  type: NotificationType | string;
  title: string;
  body?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  boardId?: string | null;
  cardId?: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationsQuery {
  cursor?: string;
  limit?: number;
  unreadOnly?: boolean;
}

export type FileEntityType = 'card' | 'document';
export type FileUploadStatus = 'pending' | 'completed' | 'failed';

export interface FileAttachment {
  id: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  entityType: FileEntityType;
  entityId: string;
  status: FileUploadStatus;
  createdAt: string;
}

export interface PresignedUploadRequest {
  fileName: string;
  mimeType: string;
  fileSize: number;
  entityType: FileEntityType;
  entityId: string;
}

export interface PresignedUploadResponse {
  fileId: string;
  uploadUrl: string;
  s3Key: string;
  expiresIn: number;
}

export interface ConfirmUploadResponse {
  fileId: string;
  status: FileUploadStatus;
}

export interface FileDownloadResponse {
  downloadUrl: string;
  expiresIn: number;
}

export interface ActivityEventItem {
  id: string;
  workspaceId: string;
  boardId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  actorId: string;
  actor?: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
  };
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface ActivityFeedQuery {
  cursor?: string;
  limit?: number;
  entityType?: string;
  entityId?: string;
  actorId?: string;
  boardId?: string;
}
