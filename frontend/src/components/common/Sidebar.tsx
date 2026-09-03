import React, { useState, useEffect, useRef } from 'react'
import { Link, useParams, useLocation, useNavigate } from 'react-router-dom'
import { useWorkspace } from '../../stores/workspace.store'
import { workspaceApi } from '../../api/endpoints'
import { useToast } from '../../stores/toast.store'
import { Modal } from './Modal'
import {
  IconBoard,
  IconDocument,
  IconUsers,
  IconMail,
  IconPlus,
  IconTag,
  IconChevronLeft,
  IconChevronRight,
  IconChevronDown,
} from './Icons'

export function Sidebar() {
  const { wid } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { currentWorkspace, fetchWorkspaces, workspaces, setCurrentWorkspace } = useWorkspace()
  const { addToast } = useToast()

  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('sb_sidebar_collapsed') === 'true'
  })
  const [showWsDropdown, setShowWsDropdown] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newWsName, setNewWsName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const wsDropdownRef = useRef<HTMLDivElement | null>(null)

  // Close workspace dropdown on click outside or Escape
  useEffect(() => {
    if (!showWsDropdown) return

    const handleClickOutside = (e: Event) => {
      if (
        wsDropdownRef.current &&
        !wsDropdownRef.current.contains(e.target as Node)
      ) {
        setShowWsDropdown(false)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowWsDropdown(false)
      }
    }

    document.addEventListener('pointerdown', handleClickOutside, true)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside, true)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [showWsDropdown])

  const activeWid = wid || currentWorkspace?.id

  const toggleCollapsed = () => {
    const next = !isCollapsed
    setIsCollapsed(next)
    localStorage.setItem('sb_sidebar_collapsed', String(next))
  }

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newWsName.trim()) return

    setIsCreating(true)
    const res = await workspaceApi.create({ name: newWsName.trim() })
    setIsCreating(false)

    if (res.success && res.data) {
      setNewWsName('')
      setShowCreateModal(false)
      setShowWsDropdown(false)
      addToast(`Workspace "${res.data.name}" created!`, 'success')
      await fetchWorkspaces()
      navigate(`/workspaces/${res.data.id}`)
    } else {
      addToast(res.error?.message || 'Failed to create workspace', 'error')
    }
  }

  // Determine active tab
  const searchParams = new URLSearchParams(location.search)
  const currentTab = searchParams.get('tab') || 'boards'
  const isDocumentsPage = location.pathname.includes('/documents')
  const isWorkspaceDetailPage =
    location.pathname.startsWith('/workspaces/') &&
    !location.pathname.includes('/boards/') &&
    !isDocumentsPage

  const navItems = [
    {
      tab: 'boards',
      label: 'Boards',
      icon: <IconBoard size={17} />,
      to: `/workspaces/${activeWid}?tab=boards`,
      active: isWorkspaceDetailPage && currentTab === 'boards',
    },
    {
      tab: 'docs',
      label: 'Documents',
      icon: <IconDocument size={17} />,
      to: `/workspaces/${activeWid}?tab=docs`,
      active: (isWorkspaceDetailPage && currentTab === 'docs') || isDocumentsPage,
    },
    {
      tab: 'labels',
      label: 'Labels',
      icon: <IconTag size={17} />,
      to: `/workspaces/${activeWid}?tab=labels`,
      active: isWorkspaceDetailPage && currentTab === 'labels',
    },
    {
      tab: 'members',
      label: 'Team Members',
      icon: <IconUsers size={17} />,
      to: `/workspaces/${activeWid}?tab=members`,
      active: isWorkspaceDetailPage && currentTab === 'members',
    },
    {
      tab: 'invitations',
      label: 'Invitations',
      icon: <IconMail size={17} />,
      to: `/workspaces/${activeWid}?tab=invitations`,
      active: isWorkspaceDetailPage && currentTab === 'invitations',
    },
  ]

  return (
    <aside
      style={{
        width: isCollapsed ? 68 : 254,
        minWidth: isCollapsed ? 68 : 254,
        background: 'rgba(18, 18, 22, 0.96)',
        backdropFilter: 'blur(12px)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: isCollapsed ? '16px 8px' : '16px 12px',
        transition: 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        overflow: 'visible',
        zIndex: 20,
      }}
    >
      <div style={{ display: 'grid', gap: 16 }}>
        {/* Workspace Switcher & Collapse Toggle */}
        <div ref={wsDropdownRef} style={{ position: 'relative' }}>
          {isCollapsed ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10,
              }}
            >
              {/* Collapsed Workspace Avatar */}
              <button
                type="button"
                onClick={() => setShowWsDropdown(!showWsDropdown)}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 800,
                  fontSize: 16,
                  color: '#fff',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
                }}
                title={currentWorkspace ? `${currentWorkspace.name} (${currentWorkspace.role})` : 'Workspaces'}
              >
                {(currentWorkspace?.name[0] || 'W').toUpperCase()}
              </button>

              {/* Expand Toggle */}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={toggleCollapsed}
                style={{
                  padding: 6,
                  borderRadius: 8,
                  color: 'var(--muted)',
                  display: 'grid',
                  placeItems: 'center',
                }}
                title="Expand sidebar"
              >
                <IconChevronRight size={16} />
              </button>
            </div>
          ) : (
            <div>
              {/* Header row: Workspace switcher + Collapse button */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--muted)',
                    paddingLeft: 4,
                  }}
                >
                  Workspace
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '2px 6px', fontSize: 11, color: 'var(--primary)' }}
                    onClick={() => setShowCreateModal(true)}
                    title="Create new workspace"
                  >
                    <IconPlus size={12} /> New
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={toggleCollapsed}
                    style={{
                      padding: '4px 6px',
                      borderRadius: 6,
                      color: 'var(--muted)',
                    }}
                    title="Collapse sidebar"
                  >
                    <IconChevronLeft size={15} />
                  </button>
                </div>
              </div>

              {/* Current Workspace Pill / Dropdown Trigger */}
              {currentWorkspace ? (
                <div
                  onClick={() => setShowWsDropdown(!showWsDropdown)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    background: 'var(--bg3)',
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s ease',
                  }}
                  title="Click to switch workspace"
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                      display: 'grid',
                      placeItems: 'center',
                      fontWeight: 800,
                      fontSize: 14,
                      color: '#fff',
                      flexShrink: 0,
                    }}
                  >
                    {(currentWorkspace.name[0] || 'W').toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 13,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {currentWorkspace.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted2)', textTransform: 'capitalize' }}>
                      {currentWorkspace.role || 'member'}
                    </div>
                  </div>
                  <span style={{ color: 'var(--muted)', flexShrink: 0 }}>
                    <IconChevronDown size={14} />
                  </span>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--muted2)', padding: '6px' }}>
                  No workspace selected.
                </div>
              )}
            </div>
          )}

          {/* Workspace Switcher Popover */}
          {showWsDropdown && (
            <div
              style={{
                position: 'absolute',
                top: isCollapsed ? 46 : 80,
                left: isCollapsed ? 74 : 0,
                width: 240,
                background: 'var(--bg2)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
                zIndex: 100,
                padding: 6,
                display: 'grid',
                gap: 4,
              }}
            >
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--muted)',
                  padding: '6px 8px 4px',
                }}
              >
                Switch Workspace
              </div>

              <div style={{ maxHeight: 200, overflowY: 'auto', display: 'grid', gap: 2 }}>
                {workspaces.map((w) => {
                  const isCurrent = w.id === activeWid
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => {
                        setCurrentWorkspace(w)
                        setShowWsDropdown(false)
                        navigate(`/workspaces/${w.id}`)
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 8px',
                        borderRadius: 8,
                        background: isCurrent ? 'rgba(124, 58, 237, 0.15)' : 'transparent',
                        border: isCurrent ? '1px solid rgba(124, 58, 237, 0.3)' : '1px solid transparent',
                        color: isCurrent ? '#a78bfa' : 'var(--text)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        width: '100%',
                        fontSize: 12.5,
                        fontWeight: isCurrent ? 700 : 500,
                      }}
                    >
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 6,
                          background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: 11,
                          fontWeight: 800,
                          color: '#fff',
                        }}
                      >
                        {(w.name[0] || 'W').toUpperCase()}
                      </div>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {w.name}
                      </span>
                      {isCurrent && <span style={{ fontSize: 11 }}>✓</span>}
                    </button>
                  )
                })}
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 4, marginTop: 2 }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowWsDropdown(false)
                    setShowCreateModal(true)
                  }}
                  className="btn btn-ghost btn-sm"
                  style={{ width: '100%', justifyContent: 'flex-start', fontSize: 12, gap: 6 }}
                >
                  <IconPlus size={14} /> Create New Workspace
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Primary Workspace Navigation Links */}
        {activeWid && (
          <nav style={{ display: 'grid', gap: 4 }}>
            {!isCollapsed && (
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--muted)',
                  padding: '4px 6px',
                }}
              >
                Navigation
              </div>
            )}

            {navItems.map((item) => (
              <Link
                key={item.tab}
                to={item.to}
                className="btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  gap: 10,
                  padding: isCollapsed ? '10px 0' : '8px 10px',
                  fontSize: 13,
                  borderRadius: 9,
                  background: item.active ? 'rgba(124, 58, 237, 0.18)' : 'transparent',
                  color: item.active ? '#c4b5fd' : 'var(--text)',
                  border: item.active ? '1px solid rgba(124, 58, 237, 0.35)' : '1px solid transparent',
                  fontWeight: item.active ? 700 : 500,
                  transition: 'all 0.15s ease',
                }}
                title={isCollapsed ? item.label : undefined}
              >
                <span style={{ color: item.active ? 'var(--primary)' : 'var(--muted)' }}>
                  {item.icon}
                </span>
                {!isCollapsed && <span>{item.label}</span>}
              </Link>
            ))}
          </nav>
        )}
      </div>

      {/* Footer: Collapse button & info */}
      <div
        style={{
          borderTop: '1px solid var(--border)',
          paddingTop: 10,
          display: 'flex',
          justifyContent: isCollapsed ? 'center' : 'space-between',
          alignItems: 'center',
        }}
      >
        {!isCollapsed && (
          <span style={{ fontSize: 10.5, color: 'var(--muted2)', paddingLeft: 4 }}>
            SyncBoard Realtime
          </span>
        )}
        <button
          type="button"
          onClick={toggleCollapsed}
          className="btn btn-ghost btn-sm"
          style={{
            padding: '4px 8px',
            fontSize: 11,
            color: 'var(--muted)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <IconChevronRight size={15} />
          ) : (
            <>
              <IconChevronLeft size={15} /> Collapse
            </>
          )}
        </button>
      </div>

      {/* Quick Create Workspace Modal */}
      {showCreateModal && (
        <Modal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title="Create New Workspace"
          maxWidth={440}
        >
          <form onSubmit={handleCreateWorkspace} style={{ display: 'grid', gap: 14 }}>
            <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>
              Workspace Name
              <input
                value={newWsName}
                onChange={(e) => setNewWsName(e.target.value)}
                placeholder="Engineering, Design Team, etc."
                required
                minLength={2}
                autoFocus
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </button>
              <button className="btn btn-primary" type="submit" disabled={isCreating}>
                {isCreating ? 'Creating…' : 'Create Workspace'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </aside>
  )
}
