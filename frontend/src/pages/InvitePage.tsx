import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { workspaceApi } from '../api/endpoints'
import { useAuth } from '../stores/auth.store'
import { useToast } from '../stores/toast.store'
import { IconMail } from '../components/common/Icons'

export function InvitePage() {
  const { token: routeToken } = useParams()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated, user, clearAuth } = useAuth()
  const { addToast } = useToast()

  const extractedToken = routeToken || searchParams.get('token') || ''
  const [token, setToken] = useState(extractedToken)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (extractedToken && extractedToken !== token) {
      setToken(extractedToken)
    }
  }, [extractedToken])

  const handleAccept = async () => {
    if (!token.trim()) return

    setLoading(true)
    setError('')
    const res = await workspaceApi.acceptInvitation(token.trim())
    setLoading(false)

    if (res.success && res.data) {
      addToast('Successfully joined the workspace!', 'success')
      navigate(`/workspaces/${res.data.workspaceId}`)
    } else {
      setError(
        res.error?.message ||
          'This invitation token is invalid, already used, or has expired.',
      )
    }
  }

  const handleSwitchAccount = () => {
    clearAuth()
    navigate(`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`)
  }

  const currentInviteUrl = location.pathname + location.search

  return (
    <div
      className="grid-bg"
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 20,
        background:
          'radial-gradient(1000px 600px at 50% -10%, rgba(124, 58, 237, 0.3), transparent 60%), var(--bg)',
      }}
    >
      <div
        className="card shine"
        style={{
          width: '100%',
          maxWidth: 480,
          padding: 36,
          display: 'grid',
          gap: 24,
          borderRadius: 22,
          textAlign: 'center',
          background: 'linear-gradient(180deg, rgba(28, 28, 31, 0.95) 0%, rgba(18, 18, 21, 0.95) 100%)',
          boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.08)',
        }}
      >
        {/* Brand & Invite Icon */}
        <div style={{ display: 'grid', gap: 10 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #7c3aed, #06b6d4)',
              display: 'grid',
              placeItems: 'center',
              color: '#fff',
              margin: '0 auto',
              boxShadow: '0 10px 30px rgba(124, 58, 237, 0.4)',
            }}
          >
            <IconMail size={26} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.5px' }}>
            Workspace Invitation
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>
            You've been invited to collaborate on a workspace in SyncBoard.
          </p>
        </div>

        {/* Token Input if accessed without token param */}
        {!extractedToken && (
          <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--muted)', textAlign: 'left' }}>
            Invitation Token
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste invite token here…"
              required
            />
          </label>
        )}

        {error && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              padding: '12px 16px',
              borderRadius: 12,
              fontSize: 13,
              textAlign: 'left',
              display: 'grid',
              gap: 8,
            }}
          >
            <div>{error}</div>
            {isAuthenticated && error.toLowerCase().includes('different email') && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleSwitchAccount}
                style={{ justifySelf: 'flex-start', color: '#fff', background: 'rgba(239, 68, 68, 0.3)' }}
              >
                Sign in with a different email →
              </button>
            )}
          </div>
        )}

        {isAuthenticated ? (
          <div style={{ display: 'grid', gap: 16 }}>
            <div
              style={{
                padding: 16,
                background: 'var(--bg3)',
                borderRadius: 14,
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                textAlign: 'left',
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#fff',
                  fontWeight: 900,
                }}
              >
                {(user?.displayName?.[0] || 'U').toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 14 }}>
                  {user?.displayName}
                </div>
                <div style={{ color: 'var(--muted)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.email}
                </div>
              </div>
              <span className="badge badge-emerald" style={{ fontSize: 11 }}>
                Logged In
              </span>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleAccept}
              disabled={loading || !token.trim()}
              style={{ padding: '14px', fontSize: 15, fontWeight: 800 }}
            >
              {loading ? 'Joining Workspace…' : 'Accept & Join Workspace →'}
            </button>

            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleSwitchAccount}
              style={{ fontSize: 12 }}
            >
              Not {user?.displayName}? Switch account
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            <p style={{ fontSize: 13, color: 'var(--muted2)' }}>
              Sign in with your existing account or create a new one to accept this invitation.
            </p>

            <Link
              to={`/login?redirect=${encodeURIComponent(currentInviteUrl)}`}
              className="btn btn-primary"
              style={{ padding: '12px', fontSize: 14 }}
            >
              Sign In to Accept
            </Link>

            <Link
              to={`/register?redirect=${encodeURIComponent(currentInviteUrl)}`}
              className="btn"
              style={{ padding: '12px', fontSize: 14 }}
            >
              Create Account to Accept
            </Link>
          </div>
        )}

        <div style={{ fontSize: 12, color: 'var(--muted2)' }}>
          SyncBoard • Secure real-time collaborative platform
        </div>
      </div>
    </div>
  )
}
