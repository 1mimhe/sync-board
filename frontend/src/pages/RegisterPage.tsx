import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../stores/auth.store'
import { useToast } from '../stores/toast.store'
import { authApi } from '../api/endpoints'
import { IconGoogle, IconEye, IconEyeOff } from '../components/common/Icons'
import { FloatingLogoutAllButton } from '../components/auth/FloatingLogoutAllButton'
import { ToastContainer } from '../components/common/Toast'

export function RegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isAuthenticated, setAuth } = useAuth()
  const { addToast } = useToast()

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')

  const redirectUrl = searchParams.get('redirect') || '/workspaces'

  // If already authenticated, redirect to workspaces
  useEffect(() => {
    if (isAuthenticated) {
      navigate(redirectUrl, { replace: true })
    }
  }, [isAuthenticated, redirectUrl, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await authApi.register({
      displayName: displayName.trim(),
      email: email.trim(),
      password,
    })
    setLoading(false)

    if (res.success && res.data) {
      setAuth(res.data.tokens.accessToken, res.data.user)
      addToast(`Account created! Welcome to SyncBoard, ${res.data.user.displayName}`, 'success')
      navigate(redirectUrl)
    } else {
      setError(res.error?.message || 'Registration failed')
    }
  }

  const handleGoogleRegister = async () => {
    setGoogleLoading(true)
    setError('')
    const res = await authApi.getGoogleAuthUrl({ redirect: redirectUrl })
    setGoogleLoading(false)

    if (res.success && res.data?.url) {
      window.location.href = res.data.url
    } else {
      setError(res.error?.message || 'Google OAuth is not configured in this environment.')
      addToast('Google OAuth authorization request failed', 'error')
    }
  }

  return (
    <div
      className="grid-bg"
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 20,
        position: 'relative',
        background:
          'radial-gradient(1000px 600px at 80% -10%, rgba(124, 58, 237, 0.25), transparent 60%), var(--bg)',
      }}
    >
      <div
        className="card shine"
        style={{
          width: '100%',
          maxWidth: 440,
          padding: 32,
          display: 'grid',
          gap: 20,
          borderRadius: 20,
          background: 'linear-gradient(180deg, rgba(28, 28, 31, 0.95) 0%, rgba(18, 18, 21, 0.95) 100%)',
          boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.08)',
        }}
      >
        <div style={{ display: 'grid', gap: 8, textAlign: 'center' }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #7c3aed, #06b6d4)',
              display: 'grid',
              placeItems: 'center',
              color: '#fff',
              fontWeight: 900,
              fontSize: 24,
              margin: '0 auto',
            }}
          >
            ◈
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.6px' }}>
            Create an Account
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 13.5 }}>
            Join SyncBoard to collaborate with your team.
          </p>
        </div>

        {/* Google OAuth Button */}
        <button
          type="button"
          className="btn btn-ghost"
          onClick={handleGoogleRegister}
          disabled={googleLoading || loading}
          style={{
            width: '100%',
            padding: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            background: 'var(--bg3)',
            border: '1px solid var(--border)',
            fontWeight: 700,
            fontSize: 13.5,
          }}
        >
          <IconGoogle size={18} />
          <span>{googleLoading ? 'Connecting to Google…' : 'Continue with Google'}</span>
        </button>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border)' }} />
          <span style={{ fontSize: 11.5, color: 'var(--muted2)', textTransform: 'uppercase', fontWeight: 700 }}>
            or with email
          </span>
          <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border)' }} />
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
          <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>
            Full Name / Display Name
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Sarah Connor"
              required
              minLength={2}
            />
          </label>

          <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>
            Email Address
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
            />
          </label>

          <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>
            Password
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
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
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#fca5a5',
                padding: '10px 14px',
                borderRadius: 10,
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          <button
            className="btn btn-primary"
            type="submit"
            disabled={loading || googleLoading}
            style={{ width: '100%', padding: '12px', marginTop: 4 }}
          >
            {loading ? 'Creating Account…' : 'Create Account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
          Already have an account?{' '}
          <Link to={`/login${redirectUrl !== '/workspaces' ? `?redirect=${encodeURIComponent(redirectUrl)}` : ''}`} style={{ color: 'var(--violet2)', fontWeight: 700 }}>
            Sign in
          </Link>
        </div>
      </div>

      {/* Floating Logout All Button */}
      <FloatingLogoutAllButton />
      <ToastContainer />
    </div>
  )
}
