import type { ApiResponse } from '../types'
import { useAuth } from '../stores/auth.store'

export const API_BASE = '/api'

let refreshPromise: Promise<string | null> | null = null

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })

      const json = (await response.json().catch(() => null)) as {
        data?: { accessToken?: string }
        accessToken?: string
      } | null
      const newToken = json?.data?.accessToken || json?.accessToken || null

      if (response.ok && newToken) {
        useAuth.getState().setToken(newToken)
        return newToken
      }

      // If refresh explicitly failed with 401/403, clear local credentials
      if (response.status === 401 || response.status === 403) {
        useAuth.getState().clearAuth()
      }
      return null
    } catch {
      return null
    } finally {
      setTimeout(() => {
        refreshPromise = null
      }, 500)
    }
  })()

  return refreshPromise
}

export interface ApiFetchOptions extends RequestInit {
  token?: string | null
  _retry?: boolean
}

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<ApiResponse<T>> {
  const { token = useAuth.getState().token, _retry = false, ...fetchOptions } = options

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string> | undefined),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...fetchOptions,
      headers,
      credentials: 'include',
    })

    const rawJson = await response.json().catch(() => null)

    // Backend standard format: { success, data, error, meta } or raw NestJS envelope
    let result: ApiResponse<T>
    if (rawJson && typeof rawJson === 'object' && 'success' in rawJson) {
      result = rawJson as ApiResponse<T>
    } else if (response.ok) {
      result = { success: true, data: rawJson as T }
    } else {
      const rawMsg = rawJson?.error?.message ?? rawJson?.message
      const formattedMsg = Array.isArray(rawMsg)
        ? rawMsg.join(', ')
        : typeof rawMsg === 'string'
        ? rawMsg
        : response.statusText || 'Request failed'

      result = {
        success: false,
        error: {
          code: rawJson?.error?.code || rawJson?.code || rawJson?.error || `HTTP_${response.status}`,
          message: formattedMsg,
          statusCode: response.status,
        },
      }
    }

    // Auto-refresh on 401 / TOKEN_EXPIRED if we had a token and haven't retried yet
    const errCode = result.error?.code
    const isAuthError =
      response.status === 401 ||
      errCode === 'TOKEN_EXPIRED' ||
      errCode === 'TOKEN_INVALID' ||
      errCode === 'TOKEN_REVOKED' ||
      errCode === 'UNAUTHORIZED'

    const isAuthEndpoint =
      path.includes('/auth/refresh') ||
      path.includes('/auth/login') ||
      path.includes('/auth/register') ||
      path.includes('/auth/logout')

    if (isAuthError && !isAuthEndpoint && !_retry && token) {
      const freshToken = await refreshAccessToken()
      if (freshToken) {
        return apiFetch<T>(path, { ...options, token: freshToken, _retry: true })
      } else {
        // If refresh fails on protected page, redirect to login
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/invite')) {
          useAuth.getState().clearAuth()
        }
      }
    }

    return result
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network connection failed'
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message,
      },
    }
  }
}
