import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { authApi } from '../api/endpoints'
import { useAuth } from '../stores/auth.store'
import { useToast } from '../stores/toast.store'

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const { user, setUser } = useAuth()
  const { addToast } = useToast()

  const token = searchParams.get('token') || ''
  const [loading, setLoading] = useState(!!token)
  const [verified, setVerified] = useState(false)
  const [error, setError] = useState('')
  const [manualToken, setManualToken] = useState('')

  const handleVerify = async (tokenToUse: string) => {
    setLoading(true)
    setError('')
    const res = await authApi.verifyEmail(tokenToUse)
    setLoading(false)

    if (res.success) {
      setVerified(true)
      if (user) {
        setUser({ ...user, isEmailVerified: true })
      }
      addToast('Email verified successfully!', 'success')
    } else {
      setError(res.error?.message || 'Verification token is invalid or has expired')
    }
  }

  useEffect(() => {
    if (token) {
      handleVerify(token)
    }
  }, [token])

  return (
    <div className="grid-bg" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div className="card shine" style={{ width: '100%', maxWidth: 440, padding: 32, display: 'grid', gap: 20, textAlign: 'center', borderRadius: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900 }}>Email Verification</h1>

        {loading ? (
          <div style={{ padding: 20, color: 'var(--muted)' }}>Verifying email token…</div>
        ) : verified ? (
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ padding: 16, background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 12, color: '#6ee7b7', fontSize: 14 }}>
              ✓ Your email address has been successfully verified!
            </div>
            <Link to="/workspaces" className="btn btn-primary">
              Go to Workspaces Dashboard
            </Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {error && (
              <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '10px 12px', borderRadius: 10, fontSize: 13 }}>
                {error}
              </div>
            )}
            <form onSubmit={(e) => { e.preventDefault(); handleVerify(manualToken) }} style={{ display: 'grid', gap: 12 }}>
              <input
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="Paste verification token here…"
                required
              />
              <button className="btn btn-primary" type="submit">
                Verify Email
              </button>
            </form>
            <Link to="/workspaces" className="btn btn-ghost">
              Back to Dashboard
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
