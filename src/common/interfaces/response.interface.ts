export interface ApiErrorDetail {
  field?: string;
  message: string;
  value?: unknown;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  statusCode: number;
  details?: Record<string, unknown> | { errors: ApiErrorDetail[] };
  timestamp: string;
  requestId?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiErrorPayload;
  meta?: {
    timestamp: string;
    requestId?: string;
    [key: string]: unknown;
  };
}
