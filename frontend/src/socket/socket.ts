import { io, Socket } from 'socket.io-client'
import { useAuth } from '../stores/auth.store'
import { refreshAccessToken } from '../api/client'

interface AuthedSocket extends Socket {
  _isRefreshing?: boolean
}

export function createAuthedSocket(): Socket {
  const token = useAuth.getState().token

  const socket = io({
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 8,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  }) as AuthedSocket

  const handleAuthError = async (err: unknown) => {
    const errorObj = typeof err === 'object' && err !== null ? (err as Record<string, unknown>) : null
    const raw = (errorObj?.message as string) || (errorObj?.code as string) || String(err || '')
    const isTokenErr = /TOKEN_EXPIRED|TOKEN_INVALID|TOKEN_REVOKED|Unauthorized/i.test(raw)
    if (!isTokenErr) return

    if (socket._isRefreshing) return
    socket._isRefreshing = true

    try {
      const freshToken = await refreshAccessToken()
      if (freshToken) {
        if (typeof socket.auth === 'object' && socket.auth !== null) {
          (socket.auth as Record<string, unknown>).token = freshToken
        } else {
          socket.auth = { token: freshToken }
        }
        socket.disconnect().connect()
      } else {
        useAuth.getState().clearAuth()
      }
    } finally {
      socket._isRefreshing = false
    }
  }

  socket.on('connect_error', handleAuthError)
  socket.on('error', handleAuthError)
  socket.on('token:expired', handleAuthError)

  return socket
}
