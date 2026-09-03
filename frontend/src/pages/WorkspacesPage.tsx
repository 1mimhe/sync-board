import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { WorkspaceWithRole } from '../types'
import { workspaceApi } from '../api/endpoints'
import { useWorkspace } from '../stores/workspace.store'
import { useToast } from '../stores/toast.store'
import { IconPlus, IconShield } from '../components/common/Icons'

export function WorkspacesPage() {
  const { fetchWorkspaces } = useWorkspace()
  const { addToast } = useToast()

  const [workspaces, setWorkspaces] = useState<WorkspaceWithRole[]>([])
  const [loading, setLoading] = useState(false)
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)

  // New workspace modal/form
  const [newWsName, setNewWsName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const loadWorkspaces = async (nextCursor?: string | null) => {
    setLoading(true)
    const res = await workspaceApi.listMine({ cursor: nextCursor || undefined, limit: 12 })
    setLoading(false)

    if (res.success && res.data) {
      if (nextCursor) {
        setWorkspaces((prev) => [...prev, ...res.data!.items])
      } else {
        setWorkspaces(res.data.items)
      }
      setCursor(res.data.pagination.cursor || null)
      setHasMore(!!res.data.pagination.hasMore)
      fetchWorkspaces()
    }
  }

  useEffect(() => {
    loadWorkspaces(null)
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newWsName.trim()) return

    setIsCreating(true)
    const res = await workspaceApi.create({ name: newWsName.trim() })
    setIsCreating(false)

    if (res.success && res.data) {
      setNewWsName('')
      addToast(`Workspace "${res.data.name}" created!`, 'success')
      loadWorkspaces(null)
    } else {
      addToast(res.error?.message || 'Failed to create workspace', 'error')
    }
  }

  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 1100, margin: '0 auto', width: '100%' }}>
      {/* Header & Quick Create */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.6px' }}>
            Workspaces
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 13.5, marginTop: 4 }}>
            Collaborative hubs for your boards, docs, and team members.
          </p>
        </div>

        <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8 }}>
          <input
            value={newWsName}
            onChange={(e) => setNewWsName(e.target.value)}
            placeholder="New workspace name…"
            style={{ minWidth: 240, fontSize: 13 }}
            required
            minLength={2}
          />
          <button className="btn btn-primary" type="submit" disabled={isCreating}>
            <IconPlus size={16} /> {isCreating ? 'Creating…' : 'Create Workspace'}
          </button>
        </form>
      </div>

      {/* Workspaces Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 16,
        }}
      >
        {workspaces.map((ws) => (
          <Link
            key={ws.id}
            to={`/workspaces/${ws.id}`}
            className="card shine"
            style={{
              padding: 20,
              display: 'grid',
              gap: 16,
              textDecoration: 'none',
              transition: 'transform 0.15s ease, border-color 0.15s ease',
              borderRadius: 16,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#fff',
                  fontWeight: 900,
                  fontSize: 20,
                  boxShadow: '0 4px 14px rgba(124, 58, 237, 0.3)',
                }}
              >
                {(ws.name[0] || 'W').toUpperCase()}
              </div>

              <span
                className={`badge ${
                  ws.role === 'owner' ? 'badge-violet' : ws.role === 'admin' ? 'badge-emerald' : ''
                }`}
                style={{ textTransform: 'capitalize', fontSize: 11 }}
              >
                {ws.role === 'owner' && <IconShield size={12} />}
                {ws.role || 'member'}
              </span>
            </div>

            <div>
              <div style={{ fontWeight: 800, fontSize: 17, color: '#fff', letterSpacing: '-0.3px' }}>
                {ws.name}
              </div>
              <div style={{ color: 'var(--muted2)', fontSize: 12, marginTop: 4 }}>
                slug: <code>{ws.slug}</code> • Created {new Date(ws.createdAt).toLocaleDateString()}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <span className="badge" style={{ fontSize: 11 }}>Boards</span>
              <span className="badge" style={{ fontSize: 11 }}>Docs</span>
              <span className="badge" style={{ fontSize: 11 }}>Members</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--violet2)', fontWeight: 700 }}>
                Enter →
              </span>
            </div>
          </Link>
        ))}
      </div>

      {workspaces.length === 0 && !loading && (
        <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--muted)' }}>
          No workspaces found. Create your first workspace above to get started!
        </div>
      )}

      {hasMore && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button className="btn btn-ghost" onClick={() => loadWorkspaces(cursor)} disabled={loading}>
            {loading ? 'Loading…' : 'Load More Workspaces'}
          </button>
        </div>
      )}
    </div>
  )
}
