import { useState } from 'react'
import { useAuth } from '../../stores/auth.store'
import { useToast } from '../../stores/toast.store'
import { authApi } from '../../api/endpoints'
import { IconMail } from '../common/Icons'

export function EmailVerificationBanner() {
  const { user } = useAuth()
  const { addToast } = useToast()
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  if (!user || user.isEmailVerified) return null

  const handleResend = async () => {
    setSending(true)
    const res = await authApi.resendVerification()
    setSending(false)
    if (res.success) {
      setSent(true)
      addToast('Verification email link sent!', 'success')
    } else {
      addToast(res.error?.message || 'Failed to resend verification link', 'error')
    }
  }

  return (
    <div
      style={{
        background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.15), rgba(217, 119, 6, 0.15))',
        borderBottom: '1px solid rgba(245, 158, 11, 0.3)',
        padding: '8px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: 13,
        color: '#fef3c7',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <IconMail size={16} />
        <span>
          Please verify your email address (<b>{user.email}</b>) to unlock full workspace permissions.
        </span>
      </div>
      <button
        className="btn btn-sm"
        style={{
          background: 'rgba(245, 158, 11, 0.25)',
          borderColor: 'rgba(245, 158, 11, 0.5)',
          color: '#fff',
          padding: '3px 10px',
          fontSize: 12,
        }}
        onClick={handleResend}
        disabled={sending || sent}
      >
        {sending ? 'Sending…' : sent ? 'Email Sent ✓' : 'Resend Verification Link'}
      </button>
    </div>
  )
}
