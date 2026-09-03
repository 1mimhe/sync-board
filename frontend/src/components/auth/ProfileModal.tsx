import React, { useEffect, useState } from 'react'
import { Modal } from '../common/Modal'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { Avatar } from '../common/Avatar'
import { useAuth } from '../../stores/auth.store'
import { useToast } from '../../stores/toast.store'
import { authApi } from '../../api/endpoints'
import { IconShield, IconLogout, IconEye, IconEyeOff } from '../common/Icons'

export interface ProfileModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { user, setUser, clearAuth } = useAuth()
  const { addToast } = useToast()

  const [displayName, setDisplayName] = useState(user?.displayName || '')
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '')
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  const [confirmLogoutAll, setConfirmLogoutAll] = useState(false)

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '')
      setAvatarUrl(user.avatarUrl || '')
    } else if (isOpen) {
      authApi.getProfile().then((res) => {
        if (res.success && res.data) {
          setUser(res.data)
          setDisplayName(res.data.displayName || '')
          setAvatarUrl(res.data.avatarUrl || '')
        }
      })
    }
  }, [user, isOpen, setUser])

  // Password change
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  // Tab
  const [tab, setTab] = useState<'profile' | 'security'>('profile')

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!displayName.trim()) return

    setIsUpdatingProfile(true)
    const res = await authApi.updateProfile({
      displayName: displayName.trim(),
      avatarUrl: avatarUrl.trim() || null,
    })
    setIsUpdatingProfile(false)

    if (res.success && res.data) {
      setUser(res.data)
      addToast('Profile updated successfully', 'success')
    } else {
      addToast(res.error?.message || 'Failed to update profile', 'error')
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentPassword || !newPassword) return

    setIsChangingPassword(true)
    const res = await authApi.changePassword({
      currentPassword,
      newPassword,
    })
    setIsChangingPassword(false)

    if (res.success) {
      setCurrentPassword('')
      setNewPassword('')
      addToast('Password changed successfully', 'success')
    } else {
      addToast(res.error?.message || 'Failed to change password', 'error')
    }
  }

  const executeLogoutAll = async () => {
    await authApi.logoutAll()
    clearAuth()
    window.location.href = '/login'
  }

  const handleResendVerification = async () => {
    const res = await authApi.resendVerification()
    if (res.success) {
      addToast('Verification email sent! Please check your inbox.', 'success')
    } else {
      addToast(res.error?.message || 'Failed to send verification email', 'error')
    }
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Account Settings" maxWidth={560}>
      <div style={{ display: 'grid', gap: 20 }}>
        {/* User Card */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: 16,
            background: 'var(--bg3)',
            borderRadius: 14,
            border: '1px solid var(--border)',
          }}
        >
          <Avatar
            name={user?.displayName}
            email={user?.email}
            avatarUrl={user?.avatarUrl}
            size={52}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.displayName}
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2 }}>
              {user?.email}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
              <span
                className={`badge ${
                  user?.isEmailVerified ? 'badge-emerald' : 'badge-amber'
                }`}
                style={{ fontSize: 11 }}
              >
                {user?.isEmailVerified ? 'Email Verified' : 'Email Unverified'}
              </span>
              {!user?.isEmailVerified && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={handleResendVerification}
                  style={{ fontSize: 11, padding: '2px 8px' }}
                >
                  Resend Link
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
          <button
            className={`btn btn-sm ${tab === 'profile' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTab('profile')}
          >
            Profile Info
          </button>
          <button
            className={`btn btn-sm ${tab === 'security' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTab('security')}
          >
            Security & Sessions
          </button>
        </div>

        {tab === 'profile' ? (
          <form onSubmit={handleUpdateProfile} style={{ display: 'grid', gap: 14 }}>
            <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>
              Display Name
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your full name"
                required
                minLength={2}
              />
            </label>

            <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>
              Avatar Image URL
              <input
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://example.com/avatar.png"
                type="url"
              />
            </label>

            <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>
              Email Address
              <input value={user?.email || ''} disabled style={{ opacity: 0.6, cursor: 'not-allowed' }} />
              <span style={{ fontSize: 11, color: 'var(--muted2)' }}>Email address cannot be changed directly.</span>
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              <button className="btn btn-primary" type="submit" disabled={isUpdatingProfile}>
                {isUpdatingProfile ? 'Saving Changes…' : 'Save Profile'}
              </button>
            </div>
          </form>
        ) : (
          <div style={{ display: 'grid', gap: 20 }}>
            <form onSubmit={handleChangePassword} style={{ display: 'grid', gap: 14 }}>
              <div style={{ fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconShield size={16} /> Change Password
              </div>
              <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>
                Current Password
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    style={{ width: '100%', paddingRight: 40 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((prev) => !prev)}
                    className="btn-ghost"
                    tabIndex={-1}
                    title={showCurrentPassword ? 'Hide password' : 'Show password'}
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
                    {showCurrentPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                  </button>
                </div>
              </label>

              <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>
                New Password
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    required
                    minLength={8}
                    style={{ width: '100%', paddingRight: 40 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    className="btn-ghost"
                    tabIndex={-1}
                    title={showNewPassword ? 'Hide password' : 'Show password'}
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
                    {showNewPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                  </button>
                </div>
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary btn-sm" type="submit" disabled={isChangingPassword}>
                  {isChangingPassword ? 'Updating…' : 'Update Password'}
                </button>
              </div>
            </form>

            <div style={{ height: 1, background: 'var(--border)' }} />

            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: '#f87171', display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconLogout size={16} /> Device Sessions
              </div>
              <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
                Revoke all active login sessions and tokens across all computers, tablets, and phones.
              </p>
              <div>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => setConfirmLogoutAll(true)}>
                  Logout from All Devices
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>

    {/* Logout All Devices Confirmation Dialog */}
    <ConfirmDialog
      isOpen={confirmLogoutAll}
      onClose={() => setConfirmLogoutAll(false)}
      onConfirm={executeLogoutAll}
      title="Logout from All Devices"
      message="Are you sure you want to log out from all devices? All active refresh tokens will be revoked and you will be returned to the login screen."
      confirmLabel="Logout All Devices"
      confirmVariant="danger"
    />
  </>
  )
}
