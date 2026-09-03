import React, { useEffect, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import type { WorkspaceWithRole, Board, Document, WorkspaceMember } from '../types'
import { workspaceApi, boardApi, documentApi, labelApi } from '../api/endpoints'
import { useWorkspace } from '../stores/workspace.store'
import { useToast } from '../stores/toast.store'
import { MembersTab } from '../components/workspace/MembersTab'
import { InvitationsTab } from '../components/workspace/InvitationsTab'
import { WorkspaceLabelsTab } from '../components/workspace/WorkspaceLabelsTab'
import { WorkspaceSettingsModal } from '../components/workspace/WorkspaceSettingsModal'
import { ArchivedBoardsModal } from '../components/workspace/ArchivedBoardsModal'
import { createAuthedSocket } from '../socket/socket'
import {
  IconBoard,
  IconDocument,
  IconUsers,
  IconMail,
  IconSettings,
  IconPlus,
  IconStar,
  IconSearch,
  IconArchive,
  IconTag,
} from '../components/common/Icons'

type TabKey = 'boards' | 'docs' | 'labels' | 'members' | 'invitations'

export function WorkspaceDetailPage() {
  const { wid } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { fetchCurrentWorkspace } = useWorkspace()
  const { addToast } = useToast()

  const [workspace, setWorkspace] = useState<WorkspaceWithRole | null>(null)
  const [boards, setBoards] = useState<Board[]>([])
  const [docs, setDocs] = useState<Document[]>([])
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [labelsCount, setLabelsCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  // Subform states
  const [newBoardTitle, setNewBoardTitle] = useState('')
  const [newBoardColor, setNewBoardColor] = useState('#7c3aed')
  const [boardSearch, setBoardSearch] = useState('')
  const [isCreatingBoard, setIsCreatingBoard] = useState(false)

  const [newDocTitle, setNewDocTitle] = useState('')
  const [isCreatingDoc, setIsCreatingDoc] = useState(false)

  const [showSettings, setShowSettings] = useState(false)
  const [showArchivedBoards, setShowArchivedBoards] = useState(false)

  const tab = (searchParams.get('tab') as TabKey) || 'boards'
  const setTab = (t: TabKey) => {
    setSearchParams(t === 'boards' ? {} : { tab: t })
  }

  const loadData = async () => {
    if (!wid) return
    setLoading(true)

    const ws = await fetchCurrentWorkspace(wid)
    if (ws) {
      setWorkspace(ws)
    }

    const [boardsRes, docsRes, membersRes, labelsRes] = await Promise.all([
      boardApi.list(wid, { limit: 50 }),
      documentApi.list(wid, { limit: 50 }),
      workspaceApi.getMembers(wid),
      labelApi.listForWorkspace(wid),
    ])

    if (boardsRes.success && boardsRes.data) setBoards(boardsRes.data.items)
    if (docsRes.success && docsRes.data) setDocs(docsRes.data.items)
    if (membersRes.success && membersRes.data) setMembers(membersRes.data)
    if (labelsRes.success && labelsRes.data) setLabelsCount(labelsRes.data.length)

    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [wid])

  // Real-time WebSocket connection for workspace-wide events
  useEffect(() => {
    if (!wid) return

    const socket = createAuthedSocket()

    socket.on('connect', () => {
      socket.emit('workspace:join', { workspaceId: wid })
    })

    const refreshEvents = [
      'workspace:updated',
      'workspace:member-added',
      'workspace:member-removed',
      'board:created',
      'board:updated',
      'board:archived',
      'board:unarchived',
      'board:deleted',
    ]

    refreshEvents.forEach((evt) => {
      socket.on(evt, () => {
        loadData()
      })
    })

    return () => {
      socket.emit('workspace:leave', { workspaceId: wid })
      socket.disconnect()
    }
  }, [wid])

  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!wid || !newBoardTitle.trim()) return

    setIsCreatingBoard(true)
    const res = await boardApi.create(wid, {
      title: newBoardTitle.trim(),
      backgroundColor: newBoardColor,
    })
    setIsCreatingBoard(false)

    if (res.success && res.data) {
      setNewBoardTitle('')
      addToast(`Board "${res.data.title}" created!`, 'success')
      loadData()
    } else {
      addToast(res.error?.message || 'Failed to create board', 'error')
    }
  }

  const handleCreateDoc = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!wid || !newDocTitle.trim()) return

    setIsCreatingDoc(true)
    const res = await documentApi.create(wid, {
      title: newDocTitle.trim(),
    })
    setIsCreatingDoc(false)

    if (res.success && res.data) {
      setNewDocTitle('')
      addToast(`Collaborative doc "${res.data.title}" created!`, 'success')
      loadData()
    } else {
      addToast(res.error?.message || 'Failed to create document', 'error')
    }
  }

  if (loading && !workspace) {
    return <div style={{ color: 'var(--muted)', padding: 32 }}>Loading workspace…</div>
  }

  if (!workspace) {
    return (
      <div className="card" style={{ padding: 40, textAlign: 'center' }}>
        Workspace not found or access denied.
      </div>
    )
  }

  const filteredBoards = boards.filter((b) =>
    b.title.toLowerCase().includes(boardSearch.toLowerCase()),
  )

  return (
    <div style={{ display: 'grid', gap: 20, maxWidth: 1100, margin: '0 auto', width: '100%' }}>
      {/* Workspace Hero Header */}
      <div
        className="card"
        style={{
          padding: '20px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
          background: 'linear-gradient(135deg, rgba(28, 28, 31, 0.95) 0%, rgba(18, 18, 21, 0.95) 100%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #7c3aed, #06b6d4)',
              display: 'grid',
              placeItems: 'center',
              color: '#fff',
              fontWeight: 900,
              fontSize: 24,
              boxShadow: '0 8px 24px rgba(124, 58, 237, 0.35)',
            }}
          >
            {(workspace.name[0] || 'W').toUpperCase()}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.5px' }}>
                {workspace.name}
              </h1>
              <span
                className={`badge ${
                  workspace.role === 'owner' ? 'badge-violet' : 'badge-emerald'
                }`}
                style={{ textTransform: 'capitalize' }}
              >
                {workspace.role || 'member'}
              </span>
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
              slug: <code>{workspace.slug}</code> • {members.length} members • {boards.length} boards • {docs.length} docs
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowSettings(true)}
            title="Workspace Settings"
          >
            <IconSettings size={16} /> Settings
          </button>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          borderBottom: '1px solid var(--border)',
          paddingBottom: 8,
          flexWrap: 'wrap',
        }}
      >
        <button
          className={`btn ${tab === 'boards' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTab('boards')}
        >
          <IconBoard size={16} /> Boards ({boards.length})
        </button>
        <button
          className={`btn ${tab === 'docs' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTab('docs')}
        >
          <IconDocument size={16} /> Collaborative Docs ({docs.length})
        </button>
        <button
          className={`btn ${tab === 'labels' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTab('labels')}
        >
          <IconTag size={16} /> Labels ({labelsCount})
        </button>
        <button
          className={`btn ${tab === 'members' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTab('members')}
        >
          <IconUsers size={16} /> Members ({members.length})
        </button>
        <button
          className={`btn ${tab === 'invitations' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTab('invitations')}
        >
          <IconMail size={16} /> Invitations
        </button>
      </div>

      {/* Tab 1: Boards Grid */}
      {tab === 'boards' && (
        <div style={{ display: 'grid', gap: 16 }}>
          {/* Create Board & Search Controls */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <form onSubmit={handleCreateBoard} style={{ display: 'flex', gap: 8, flex: 1, minWidth: 280 }}>
              <input
                value={newBoardTitle}
                onChange={(e) => setNewBoardTitle(e.target.value)}
                placeholder="New board title (e.g. Sprint 24, Roadmaps)…"
                style={{ flex: 1, fontSize: 13 }}
                required
              />
              <input
                type="color"
                value={newBoardColor}
                onChange={(e) => setNewBoardColor(e.target.value)}
                style={{
                  width: 38,
                  height: 38,
                  padding: 2,
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--bg3)',
                  cursor: 'pointer',
                }}
                title="Board accent color"
              />
              <button className="btn btn-primary" type="submit" disabled={isCreatingBoard}>
                <IconPlus size={16} /> Create Board
              </button>
            </form>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ position: 'relative', width: 220 }}>
                <input
                  value={boardSearch}
                  onChange={(e) => setBoardSearch(e.target.value)}
                  placeholder="Search boards…"
                  style={{ width: '100%', paddingLeft: 34, fontSize: 13 }}
                />
                <IconSearch
                  size={16}
                  style={{
                    position: 'absolute',
                    left: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--muted)',
                  }}
                />
              </div>

              {workspace.role !== 'viewer' && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowArchivedBoards(true)}
                  title="View & restore archived boards"
                >
                  <IconArchive size={14} /> Archived
                </button>
              )}
            </div>
          </div>

          {/* Boards Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 16,
            }}
          >
            {filteredBoards.map((b) => (
              <Link
                key={b.id}
                to={`/workspaces/${workspace.id}/boards/${b.id}`}
                className="card shine"
                style={{
                  padding: 0,
                  overflow: 'hidden',
                  textDecoration: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: 14,
                }}
              >
                <div
                  style={{
                    height: 8,
                    background: b.backgroundColor || 'linear-gradient(90deg, #7c3aed, #06b6d4)',
                  }}
                />
                <div style={{ padding: 18, display: 'grid', gap: 12, flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: '#fff' }}>
                      {b.title}
                    </div>
                    {b.isStarred && <IconStar size={16} filled={true} />}
                  </div>

                  {b.description ? (
                    <p style={{ fontSize: 13, color: 'var(--muted)', minHeight: 36, lineHeight: 1.4 }}>
                      {b.description}
                    </p>
                  ) : (
                    <div style={{ minHeight: 36 }} />
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 10, fontSize: 11, color: 'var(--muted2)' }}>
                    <span>Updated {new Date(b.updatedAt).toLocaleDateString()}</span>
                    <span style={{ color: 'var(--violet2)', fontWeight: 700 }}>Open Board →</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {filteredBoards.length === 0 && (
            <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
              No boards found matching your search. Create one above!
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Collaborative Docs */}
      {tab === 'docs' && (
        <div style={{ display: 'grid', gap: 16 }}>
          {/* Create Document Form */}
          <form onSubmit={handleCreateDoc} style={{ display: 'flex', gap: 8 }}>
            <input
              value={newDocTitle}
              onChange={(e) => setNewDocTitle(e.target.value)}
              placeholder="New collaborative document title…"
              style={{ flex: 1, fontSize: 13 }}
              required
            />
            <button className="btn btn-primary" type="submit" disabled={isCreatingDoc}>
              <IconPlus size={16} /> Create Document
            </button>
          </form>

          {/* Docs Grid */}
          <div style={{ display: 'grid', gap: 10 }}>
            {docs.map((doc) => (
              <Link
                key={doc.id}
                to={`/workspaces/${workspace.id}/documents/${doc.id}`}
                className="card shine"
                style={{
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  textDecoration: 'none',
                  borderRadius: 14,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                      display: 'grid',
                      placeItems: 'center',
                      color: '#fff',
                    }}
                  >
                    <IconDocument size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: '#fff', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {doc.title}
                      {doc.parentCard && (
                        <span
                          className="badge"
                          style={{
                            fontSize: 11,
                            background: 'rgba(124, 58, 237, 0.15)',
                            color: '#a78bfa',
                            border: '1px solid rgba(124, 58, 237, 0.3)',
                          }}
                        >
                          Card: {doc.parentCard.title}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted2)', marginTop: 2 }}>
                      status: {doc.status} • Updated {new Date(doc.updatedAt).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="badge" style={{ fontSize: 11 }}>Real-time CRDT</span>
                  <span className="btn btn-ghost btn-sm">Open Editor →</span>
                </div>
              </Link>
            ))}

            {docs.length === 0 && (
              <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
                No documents created in this workspace yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Labels */}
      {tab === 'labels' && (
        <WorkspaceLabelsTab workspace={workspace} onLabelsCountChange={setLabelsCount} />
      )}

      {/* Tab 4: Members */}
      {tab === 'members' && (
        <MembersTab
          workspace={workspace}
          members={members}
          onRefresh={loadData}
        />
      )}

      {/* Tab 5: Invitations */}
      {tab === 'invitations' && (
        <InvitationsTab workspace={workspace} />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <WorkspaceSettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          workspace={workspace}
          onUpdated={loadData}
        />
      )}

      {/* Archived Boards Modal */}
      {showArchivedBoards && (
        <ArchivedBoardsModal
          isOpen={showArchivedBoards}
          onClose={() => setShowArchivedBoards(false)}
          workspaceId={workspace.id}
          currentRole={workspace.role}
          boards={boards}
          onRestored={loadData}
        />
      )}
    </div>
  )
}
