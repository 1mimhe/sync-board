import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '../api/endpoints'
import { useToast } from '../stores/toast.store'

export function ForgotPasswordPage() {
  const { addToast } = useToast()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setLoading(true)
    await authApi.forgotPassword(email.trim())
    setLoading(false)
    setSubmitted(true)
    addToast('If that email exists, a password reset link has been queued.', 'info')
  }

  return (
    <div
      className="grid-bg"
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 20,
        background: 'var(--bg)',
      }}
    >
      <div
        className="card shine"
        style={{
          width: '100%',
          maxWidth: 420,
          padding: 32,
          display: 'grid',
          gap: 20,
          borderRadius: 20,
        }}
      >
        <div style={{ textAlign: 'center', display: 'grid', gap: 6 }}>
          <h1 style={{ fontSize: 22, fontWeight: 900 }}>Reset Password</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>
            Enter your email and we will send you a link to reset your password.
          </p>
        </div>

        {submitted ? (
          <div style={{ display: 'grid', gap: 16, textAlign: 'center' }}>
            <div style={{ padding: 14, background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 10, color: '#6ee7b7', fontSize: 13 }}>
              Check your inbox! We've sent password reset instructions if the email was registered.
            </div>
            <Link to="/login" className="btn btn-ghost">
              Back to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
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
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? 'Sending link…' : 'Send Reset Link'}
            </button>
            <div style={{ textAlign: 'center', marginTop: 4 }}>
              <Link to="/login" style={{ color: 'var(--muted)', fontSize: 13 }}>
                Cancel and return to login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
