export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    statusCode?: number
  }
  meta?: {
    total?: number
    cursor?: string | null
    hasMore?: boolean
    page?: number
    limit?: number
  }
}

export interface Pagination {
  cursor?: string | null
  hasMore?: boolean
  total?: number
  limit?: number
}

export interface PaginatedResult<T> {
  items: T[]
  pagination: Pagination
}
