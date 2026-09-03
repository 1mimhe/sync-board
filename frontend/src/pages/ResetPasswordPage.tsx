import React, { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '../api/endpoints'
import { useAuth } from '../stores/auth.store'
import { useToast } from '../stores/toast.store'
import { IconEye, IconEyeOff } from '../components/common/Icons'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { setToken } = useAuth()
  const { addToast } = useToast()

  const tokenParam = searchParams.get('token') || ''
  const [token, setTokenInput] = useState(tokenParam)
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !newPassword) return

    setLoading(true)
    setError('')
    const res = await authApi.resetPassword({ token, newPassword })
    setLoading(false)

    if (res.success && res.data) {
      setToken(res.data.accessToken)
      addToast('Password reset successfully! You are now logged in.', 'success')
      navigate('/workspaces')
    } else {
      setError(res.error?.message || 'Invalid or expired reset token')
    }
  }

  return (
    <div className="grid-bg" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div className="card shine" style={{ width: '100%', maxWidth: 420, padding: 32, display: 'grid', gap: 20, borderRadius: 20 }}>
        <div style={{ textAlign: 'center', display: 'grid', gap: 6 }}>
          <h1 style={{ fontSize: 22, fontWeight: 900 }}>Set New Password</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>
            Choose a strong password with at least 8 characters.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
          {!tokenParam && (
            <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>
              Reset Token
              <input
                value={token}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Token from your email link"
                required
              />
            </label>
          )}

          <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>
            New Password
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                style={{ width: '100%', paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="btn-ghost"
                tabIndex={-1}
                title={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute',
                  right: 8,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--muted)',
                  cursor: 'pointer',
                  padding: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 6,
                }}
              >
                {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
              </button>
            </div>
          </label>

          {error && (
            <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '10px 12px', borderRadius: 10, fontSize: 13 }}>
              {error}
            </div>
          )}

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Resetting…' : 'Reset Password & Sign In'}
          </button>

          <div style={{ textAlign: 'center', marginTop: 4 }}>
            <Link to="/login" style={{ color: 'var(--muted)', fontSize: 13 }}>
              Back to login
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
