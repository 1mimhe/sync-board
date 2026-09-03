import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../stores/auth.store'
import { authApi } from '../../api/endpoints'
import { Avatar } from './Avatar'
import { ProfileModal } from '../auth/ProfileModal'
import {
  IconWorkspace,
  IconLogout,
  IconActivity,
  IconSettings,
} from './Icons'

export function Header() {
  const navigate = useNavigate()
  const { user, setUser, clearAuth } = useAuth()
  const [showProfileModal, setShowProfileModal] = useState(false)

  useEffect(() => {
    if (!user) {
      authApi.getProfile().then((res) => {
        if (res.success && res.data) {
          setUser(res.data)
        }
      })
    }
  }, [user, setUser])

  const handleLogout = () => {
    clearAuth()
    navigate('/login')
  }

  return (
    <>
      <header
        className="glass"
        style={{
          height: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          borderBottom: '1px solid var(--border)',
          position: 'relative',
          zIndex: 100,
        }}
      >
        {/* Brand Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link
            to="/workspaces"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontWeight: 900,
              fontSize: 18,
              letterSpacing: '-0.5px',
              color: '#ffffff',
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                background: 'linear-gradient(135deg, #7c3aed, #06b6d4)',
                display: 'grid',
                placeItems: 'center',
                boxShadow: '0 0 16px rgba(124, 58, 237, 0.4)',
              }}
            >
              <span style={{ fontSize: 16, color: '#fff' }}>◈</span>
            </div>
            <span>SyncBoard</span>
          </Link>
        </div>

        {/* Right Nav & User Profile Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link
            to="/health"
            className="btn btn-ghost btn-sm"
            title="System Diagnostics & Health Status"
          >
            <IconActivity size={15} />
            <span>Health</span>
          </Link>

          <Link
            to="/workspaces"
            className="btn btn-ghost btn-sm"
            title="All Workspaces"
          >
            <IconWorkspace size={15} />
            <span>Workspaces</span>
          </Link>

          <div
            style={{
              height: 24,
              width: 1,
              backgroundColor: 'var(--border)',
              margin: '0 4px',
            }}
          />

          {/* User Profile Trigger */}
          <button
            onClick={() => setShowProfileModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'transparent',
              border: 'none',
              padding: '4px 8px',
              borderRadius: 10,
              cursor: 'pointer',
              color: 'var(--text)',
            }}
            className="btn-ghost"
            title="Account Settings"
          >
            <Avatar
              name={user?.displayName}
              email={user?.email}
              avatarUrl={user?.avatarUrl}
              size={30}
            />
            <span style={{ fontWeight: 600, fontSize: 13, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.displayName || user?.email || 'Account'}
            </span>
            <IconSettings size={14} style={{ color: 'var(--muted)' }} />
          </button>

          <button
            onClick={handleLogout}
            className="btn btn-ghost btn-sm"
            title="Sign Out"
            style={{ color: '#f87171' }}
          >
            <IconLogout size={16} />
          </button>
        </div>
      </header>

      {showProfileModal && (
        <ProfileModal
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
        />
      )}
    </>
  )
}
