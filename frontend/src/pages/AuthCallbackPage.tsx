import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '../api/endpoints'
import { refreshAccessToken } from '../api/client'
import { useAuth } from '../stores/auth.store'
import { useToast } from '../stores/toast.store'
import { IconGoogle } from '../components/common/Icons'

export function AuthCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { setToken, setUser } = useAuth()
  const { addToast } = useToast()
  const [statusMessage, setStatusMessage] = useState('Finalizing Google Authentication…')

  useEffect(() => {
    let isCancelled = false

    const handleCallback = async () => {
      // 1. Check for token in search params or hash
      let token = searchParams.get('token')
      const redirect = searchParams.get('redirect') || '/workspaces'

      if (!token && window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
        token = hashParams.get('token') || hashParams.get('access_token')
      }

      if (token) {
        setToken(token)
        setStatusMessage('Loading user profile…')

        const profileRes = await authApi.getProfile()
        if (isCancelled) return

        if (profileRes.success && profileRes.data) {
          setUser(profileRes.data)
          addToast(`Welcome, ${profileRes.data.displayName}!`, 'success')
          navigate(redirect, { replace: true })
          return
        }
      }

      // 2. If token wasn't in URL, attempt silent token refresh (using HttpOnly cookie)
      setStatusMessage('Validating session…')
      const freshToken = await refreshAccessToken()
      if (isCancelled) return

      if (freshToken) {
        const profileRes = await authApi.getProfile()
        if (profileRes.success && profileRes.data) {
          setUser(profileRes.data)
          addToast(`Welcome, ${profileRes.data.displayName}!`, 'success')
          navigate(redirect, { replace: true })
          return
        }
      }

      // 3. Fallback on failure
      addToast('Google authentication failed or expired. Please sign in again.', 'error')
      navigate('/login', { replace: true })
    }

    handleCallback()

    return () => {
      isCancelled = true
    }
  }, [searchParams, navigate, setToken, setUser, addToast])

  return (
    <div
      className="grid-bg"
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 20,
        background:
          'radial-gradient(1000px 600px at 50% 50%, rgba(124, 58, 237, 0.2), transparent 60%), var(--bg)',
      }}
    >
      <div
        className="card shine"
        style={{
          padding: '40px 32px',
          borderRadius: 20,
          textAlign: 'center',
          display: 'grid',
          gap: 20,
          maxWidth: 420,
          width: '100%',
        }}
      >
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: 16,
            background: 'var(--bg3)',
            border: '1px solid var(--border)',
            display: 'grid',
            placeItems: 'center',
            margin: '0 auto',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
          }}
        >
          <IconGoogle size={28} />
        </div>

        <div style={{ display: 'grid', gap: 6 }}>
          <h2 style={{ fontSize: 20, fontWeight: 900 }}>Signing in with Google</h2>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>{statusMessage}</p>
        </div>

        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            border: '3px solid rgba(124, 58, 237, 0.2)',
            borderTopColor: 'var(--violet)',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto',
          }}
        />
      </div>
    </div>
  )
}
