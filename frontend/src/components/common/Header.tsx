import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../stores/auth.store'
import { authApi } from '../../api/endpoints'
import { useToast } from '../../stores/toast.store'
import { useUiStore } from '../../stores/ui.store'
import { Avatar } from './Avatar'
import { ProfileModal } from '../auth/ProfileModal'
import { NotificationBell } from '../notifications/NotificationBell'
import {
  IconWorkspace,
  IconLogout,
  IconActivity,
  IconSettings,
  IconMenu,
} from './Icons'

export function Header() {
  const navigate = useNavigate()
  const { user, setUser, clearAuth } = useAuth()
  const { addToast } = useToast()
  const { toggleMobileSidebar } = useUiStore()
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

  const handleLogout = async () => {
    try {
      await authApi.logout()
    } catch (err) {
      addToast('Logout request failed — clearing local session', 'info')
      void err
    } finally {
      clearAuth()
      navigate('/login')
    }
  }

  return (
    <>
      <header
        className="glass app-header"
        style={{
          height: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          borderBottom: '1px solid var(--border)',
          position: 'relative',
          zIndex: 100,
        }}
      >
        {/* Brand Logo & Mobile Sidebar Trigger */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            className="mobile-only-btn btn btn-ghost btn-sm"
            onClick={toggleMobileSidebar}
            title="Toggle Navigation Menu"
            aria-label="Toggle Navigation Menu"
            style={{ padding: '6px 8px' }}
          >
            <IconMenu size={18} />
          </button>

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
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 16, color: '#fff' }}>◈</span>
            </div>
            <span className="logo-text">SyncBoard</span>
          </Link>
        </div>

        {/* Right Nav & User Profile Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link
            to="/health"
            className="btn btn-ghost btn-sm nav-link-text"
            title="System Diagnostics & Health Status"
            style={{ padding: '6px 10px' }}
          >
            <IconActivity size={15} />
            <span>Health</span>
          </Link>

          <Link
            to="/workspaces"
            className="btn btn-ghost btn-sm nav-link-text"
            title="All Workspaces"
            style={{ padding: '6px 10px' }}
          >
            <IconWorkspace size={15} />
            <span>Workspaces</span>
          </Link>

          <div
            className="nav-divider"
            style={{
              height: 20,
              width: 1,
              backgroundColor: 'var(--border)',
              margin: '0 2px',
            }}
          />

          <NotificationBell />

          {/* User Profile Trigger */}
          <button
            onClick={() => setShowProfileModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'transparent',
              border: 'none',
              padding: '4px 6px',
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
              size={28}
            />
            <span
              className="user-name-text"
              style={{
                fontWeight: 600,
                fontSize: 13,
                maxWidth: 120,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {user?.displayName || user?.email || 'Account'}
            </span>
            <IconSettings size={14} style={{ color: 'var(--muted)' }} />
          </button>

          <button
            onClick={handleLogout}
            className="btn btn-ghost btn-sm"
            title="Sign Out"
            style={{ color: '#f87171', padding: '6px 8px' }}
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
