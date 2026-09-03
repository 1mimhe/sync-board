import { useState } from 'react'
import { authApi } from '../../api/endpoints'
import { refreshAccessToken } from '../../api/client'
import { useAuth } from '../../stores/auth.store'
import { useToast } from '../../stores/toast.store'
import { IconLogout } from '../common/Icons'

export function FloatingLogoutAllButton() {
  const { clearAuth, token } = useAuth()
  const { addToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const handleLogoutAll = async () => {
    if (loading) return
    setLoading(true)

    try {
      // 1. If no active access token is in store, attempt silent token refresh
      let activeToken = token
      if (!activeToken) {
        activeToken = await refreshAccessToken()
      }

      // 2. If we have a valid token (or refreshed token), call backend logoutAll
      if (activeToken) {
        await authApi.logoutAll()
      }
    } catch {
      // Benign catch - user wanted to force logout anyway, suppress noise
    } finally {
      // 3. Clear client auth store and local state
      clearAuth()
      setLoading(false)
      addToast('All active sessions and credentials have been revoked and cleared.', 'info')
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9999,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Tooltip Card absolutely positioned beside the fixed button so the button NEVER moves */}
      {isHovered && (
        <div
          className="card"
          style={{
            position: 'absolute',
            right: 54,
            bottom: 0,
            width: 230,
            padding: '10px 14px',
            background: 'rgba(24, 24, 27, 0.96)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: 12,
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.6)',
            fontSize: 12,
            lineHeight: 1.4,
            pointerEvents: 'none',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div style={{ fontWeight: 800, color: '#fca5a5', display: 'flex', alignItems: 'center', gap: 6 }}>
            Force Logout All Devices
          </div>
          <div style={{ color: 'var(--muted)', marginTop: 2, fontSize: 11.5 }}>
            Revokes and invalidates all active sessions across all devices and clears tokens.
          </div>
        </div>
      )}

      {/* Floating Action Trigger - perfectly stationary on hover */}
      <button
        type="button"
        onClick={handleLogoutAll}
        disabled={loading}
        title="Revoke all active sessions on all devices"
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: isHovered ? 'rgba(45, 20, 26, 0.95)' : 'rgba(30, 20, 24, 0.85)',
          border: isHovered ? '1px solid rgba(239, 68, 68, 0.8)' : '1px solid rgba(239, 68, 68, 0.4)',
          color: '#f87171',
          display: 'grid',
          placeItems: 'center',
          cursor: loading ? 'wait' : 'pointer',
          boxShadow: isHovered
            ? '0 0 16px rgba(239, 68, 68, 0.4), 0 4px 12px rgba(0,0,0,0.5)'
            : '0 4px 12px rgba(0, 0, 0, 0.4)',
          transition: 'background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
          backdropFilter: 'blur(8px)',
          padding: 0,
        }}
      >
        {loading ? (
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              border: '2px solid rgba(248, 113, 113, 0.3)',
              borderTopColor: '#f87171',
              animation: 'spin 0.8s linear infinite',
            }}
          />
        ) : (
          <IconLogout size={18} />
        )}
      </button>
    </div>
  )
}
