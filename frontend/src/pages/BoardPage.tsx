import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { Socket } from 'socket.io-client'
import type { BoardWithContent, PresenceViewer, WorkspaceMember } from '../types'
import { boardApi, workspaceApi } from '../api/endpoints'
import { createAuthedSocket } from '../socket/socket'
import { useAuth } from '../stores/auth.store'
import { BoardHeader } from '../components/board/BoardHeader'
import { BoardCanvas } from '../components/board/BoardCanvas'
import { BoardFilters } from '../components/board/BoardFilters'
import { ActivityDrawer } from '../components/board/ActivityDrawer'
import { ArchivedItemsModal } from '../components/board/ArchivedItemsModal'
import { BoardLabelsModal } from '../components/board/BoardLabelsModal'
import { BoardDocumentsModal } from '../components/board/BoardDocumentsModal'

export function BoardPage() {
  const { user } = useAuth()
  const { wid, bid } = useParams<{ wid: string; bid: string }>()
  const [board, setBoard] = useState<BoardWithContent | null>(null)
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [loading, setLoading] = useState(true)

  const currentMember = members.find((m) => m.userId === user?.id)
  const isViewer = currentMember?.role === 'viewer'

  // Real-time states
  const [isConnected, setIsConnected] = useState(false)
  const [viewers, setViewers] = useState<PresenceViewer[]>([])
  const socketRef = useRef<Socket | null>(null)

  // UI state
  const [showFilters, setShowFilters] = useState(false)
  const [filterQuery, setFilterQuery] = useState('')
  const [filterLabelIds, setFilterLabelIds] = useState<string[]>([])
  const [filterAssigneeId, setFilterAssigneeId] = useState<string | null>(null)
  const [showActivity, setShowActivity] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [showLabelsModal, setShowLabelsModal] = useState(false)
  const [showDocsModal, setShowDocsModal] = useState(false)

  const loadBoard = async () => {
    if (!wid || !bid) return
    const res = await boardApi.getWithContent(wid, bid)
    if (res.success && res.data) {
      setBoard(res.data)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadBoard()
    if (wid) {
      workspaceApi.getMembers(wid).then((r) => r.success && r.data && setMembers(r.data))
    }
  }, [wid, bid])

  // Real-time WebSocket connection
  useEffect(() => {
    if (!wid || !bid) return

    const socket = createAuthedSocket()
    socketRef.current = socket

    socket.on('connect', () => {
      setIsConnected(true)
      socket.emit('board:join', { boardId: bid })
      socket.emit('workspace:join', { workspaceId: wid })
    })

    socket.on('disconnect', () => {
      setIsConnected(false)
    })

    socket.on('board:joined', (payload: { boardId: string; viewers?: PresenceViewer[] }) => {
      if (payload.viewers) {
        setViewers(payload.viewers)
      }
    })

    socket.on('board:presence', (payload: { userId: string; action: 'joined' | 'left'; displayName: string; color: string; avatarUrl?: string }) => {
      if (payload.action === 'joined') {
        setViewers((prev) => {
          if (prev.some((v) => v.userId === payload.userId)) return prev
          return [
            ...prev,
            {
              userId: payload.userId,
              displayName: payload.displayName,
              color: payload.color,
              avatarUrl: payload.avatarUrl,
            },
          ]
        })
      } else {
        setViewers((prev) => prev.filter((v) => v.userId !== payload.userId))
      }
    })

    socket.on('workspace:member-added', () => {
      if (wid) workspaceApi.getMembers(wid).then((r) => r.success && r.data && setMembers(r.data))
    })

    socket.on('workspace:member-removed', () => {
      if (wid) workspaceApi.getMembers(wid).then((r) => r.success && r.data && setMembers(r.data))
    })

    // Listen to real-time entity broadcasts to refresh board state seamlessly
    const entityEvents = [
      'board:updated',
      'board:archived',
      'board:unarchived',
      'board:deleted',
      'list:created',
      'list:updated',
      'list:moved',
      'list:archived',
      'list:unarchived',
      'list:deleted',
      'card:created',
      'card:updated',
      'card:moved',
      'card:archived',
      'card:unarchived',
      'card:deleted',
      'card:comment-added',
      'card:comment-updated',
      'card:comment-deleted',
      'card:attachment-added',
      'card:attachment-deleted',
      'card:assignee-added',
      'card:assignee-removed',
      'checklist:created',
      'checklist:updated',
      'checklist:deleted',
    ]

    entityEvents.forEach((evt) => {
      socket.on(evt, () => {
        loadBoard()
      })
    })

    // Heartbeat every 30 seconds
    const hb = setInterval(() => {
      if (socket.connected) {
        socket.emit('presence:heartbeat')
      }
    }, 30000)

    return () => {
      clearInterval(hb)
      socket.emit('board:leave', { boardId: bid })
      socket.disconnect()
    }
  }, [wid, bid])

  if (loading && !board) {
    return <div style={{ color: 'var(--muted)', padding: 32 }}>Loading board…</div>
  }

  if (!board || !wid || !bid) {
    return (
      <div className="card" style={{ padding: 40, textAlign: 'center' }}>
        Board not found or access denied.
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Board Header */}
      <BoardHeader
        board={board}
        workspaceId={wid}
        isConnected={isConnected}
        viewers={viewers}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters((prev) => !prev)}
        onToggleActivity={() => setShowActivity((prev) => !prev)}
        onToggleArchived={!isViewer ? () => setShowArchived((prev) => !prev) : undefined}
        onToggleLabels={() => setShowLabelsModal((prev) => !prev)}
        onToggleDocs={() => setShowDocsModal((prev) => !prev)}
        onBoardUpdated={loadBoard}
      />

      {/* Filter Toolbar */}
      {showFilters && (
        <BoardFilters
          query={filterQuery}
          onQueryChange={setFilterQuery}
          selectedLabelIds={filterLabelIds}
          onToggleLabel={(lId) =>
            setFilterLabelIds((prev) =>
              prev.includes(lId) ? prev.filter((id) => id !== lId) : [...prev, lId],
            )
          }
          selectedAssigneeId={filterAssigneeId}
          onSelectAssignee={setFilterAssigneeId}
          labels={board.labels || []}
          members={members}
          onClearAll={() => {
            setFilterQuery('')
            setFilterLabelIds([])
            setFilterAssigneeId(null)
          }}
        />
      )}

      {/* Interactive Board Canvas */}
      <BoardCanvas
        board={board}
        workspaceId={wid}
        members={members}
        filterQuery={filterQuery}
        filterLabelIds={filterLabelIds}
        filterAssigneeId={filterAssigneeId}
        onBoardUpdated={loadBoard}
      />

      {/* Activity Log Drawer */}
      {showActivity && (
        <ActivityDrawer
          isOpen={showActivity}
          onClose={() => setShowActivity(false)}
          workspaceId={wid}
          boardId={bid}
        />
      )}

      {/* Archived Items Modal */}
      {showArchived && (
        <ArchivedItemsModal
          isOpen={showArchived}
          onClose={() => setShowArchived(false)}
          workspaceId={wid}
          board={board}
          currentRole={currentMember?.role}
          onRestored={loadBoard}
        />
      )}

      {/* Board Labels Modal */}
      {showLabelsModal && (
        <BoardLabelsModal
          isOpen={showLabelsModal}
          onClose={() => setShowLabelsModal(false)}
          workspaceId={wid}
          boardId={bid}
          labels={board.labels || []}
          onLabelsUpdated={loadBoard}
        />
      )}

      {/* Board Documents Modal (Attached Card Docs) */}
      {showDocsModal && (
        <BoardDocumentsModal
          isOpen={showDocsModal}
          onClose={() => setShowDocsModal(false)}
          workspaceId={wid}
          board={board}
        />
      )}
    </div>
  )
}
