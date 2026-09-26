import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import type { Socket } from 'socket.io-client'
import type { BoardWithContent, PresenceViewer, WorkspaceMember, BoardViewMode, Card } from '../types'
import { boardApi, workspaceApi, cardApi } from '../api/endpoints'
import { createAuthedSocket } from '../socket/socket'
import { useAuth } from '../stores/auth.store'
import { BoardHeader } from '../components/board/BoardHeader'
import { BoardCanvas } from '../components/board/BoardCanvas'
import { BoardFilters } from '../components/board/BoardFilters'
import { TableView } from '../components/board/views/TableView'
import { CalendarView } from '../components/board/views/CalendarView'
import { TimelineView } from '../components/board/views/TimelineView'
import { ActivityDrawer } from '../components/board/ActivityDrawer'
import { ArchivedItemsModal } from '../components/board/ArchivedItemsModal'
import { BoardLabelsModal } from '../components/board/BoardLabelsModal'
import { BoardDocumentsModal } from '../components/board/BoardDocumentsModal'
import { CardModal } from '../components/card/CardModal'

export function BoardPage() {
  const { user } = useAuth()
  const { wid, bid, cardId } = useParams<{ wid: string; bid: string; cardId?: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const commentId = searchParams.get('comment')

  const [board, setBoard] = useState<BoardWithContent | null>(null)
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [loading, setLoading] = useState(true)
  const [deepLinkedCard, setDeepLinkedCard] = useState<Card | null>(null)

  const currentMember = members.find((m) => m.userId === user?.id)
  const isViewer = currentMember?.role === 'viewer'

  // Real-time states
  const [isConnected, setIsConnected] = useState(false)
  const [viewers, setViewers] = useState<PresenceViewer[]>([])
  const socketRef = useRef<Socket | null>(null)

  // View state & read-only "Updated — refresh" banner
  const [activeView, setActiveView] = useState<BoardViewMode>('board')
  const [hasViewUpdates, setHasViewUpdates] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const activeViewRef = useRef(activeView)
  useEffect(() => {
    activeViewRef.current = activeView
  }, [activeView])
  const lastUpdatedAtRef = useRef<Record<string, string>>({})

  // UI state
  const [showFilters, setShowFilters] = useState(false)
  const [filterQuery, setFilterQuery] = useState('')
  const [filterLabelIds, setFilterLabelIds] = useState<string[]>([])
  const [filterAssigneeId, setFilterAssigneeId] = useState<string | null>(null)
  const [showActivity, setShowActivity] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [showLabelsModal, setShowLabelsModal] = useState(false)
  const [showDocsModal, setShowDocsModal] = useState(false)

  const loadBoard = useCallback(async () => {
    if (!wid || !bid) return
    const res = await boardApi.getWithContent(wid, bid)
    if (res.success && res.data) {
      setBoard(res.data)
    }
    setLoading(false)
  }, [wid, bid])

  // Deep-link: load card details if cardId is present in URL
  useEffect(() => {
    if (!wid || !bid || !cardId) {
      setDeepLinkedCard(null)
      return
    }
    void cardApi.getDetails(wid, bid, cardId).then((res) => {
      if (res.success && res.data) {
        setDeepLinkedCard(res.data)
      }
    })
  }, [wid, bid, cardId])

  const handleCloseDeepLinkedCard = () => {
    setDeepLinkedCard(null)
    if (cardId) {
      navigate(`/workspaces/${wid}/boards/${bid}`, { replace: true })
    }
  }

  const handleViewChange = (mode: BoardViewMode) => {
    setActiveView(mode)
    setHasViewUpdates(false)
  }

  const handleRefreshView = () => {
    setHasViewUpdates(false)
    setRefreshKey((k) => k + 1)
    void loadBoard()
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
      'card:priority_changed',
      'card:status_changed',
      'card:link_created',
      'card:link_deleted',
      'card:subcard_created',
      'card:subcard_attached',
      'card:subcard_detached',
      'card:time_logged',
      'card_field:updated',
      'card_field:deleted',
      'comment:created',
    ]

    entityEvents.forEach((evt) => {
      socket.on(evt, (payload?: unknown) => {
        if (typeof payload === 'object' && payload !== null) {
          const p = payload as Record<string, unknown>
          const cId = (p['cardId'] || p['id']) as string | undefined
          const changes = p['changes'] as Record<string, unknown> | undefined
          const updatedAt = (p['updatedAt'] || changes?.['updatedAt']) as string | undefined
          if (cId && updatedAt) {
            const last = lastUpdatedAtRef.current[cId]
            if (last && new Date(updatedAt).getTime() <= new Date(last).getTime()) {
              return
            }
            lastUpdatedAtRef.current[cId] = updatedAt
          }
        }

        if (activeViewRef.current === 'board') {
          void loadBoard()
        } else {
          setHasViewUpdates(true)
        }
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
  }, [wid, bid, loadBoard])

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
        activeView={activeView}
        onViewChange={handleViewChange}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters((prev) => !prev)}
        onToggleActivity={() => setShowActivity((prev) => !prev)}
        onToggleArchived={!isViewer ? () => setShowArchived((prev) => !prev) : undefined}
        onToggleLabels={() => setShowLabelsModal((prev) => !prev)}
        onToggleDocs={() => setShowDocsModal((prev) => !prev)}
        onBoardUpdated={loadBoard}
      />

      {/* Board View Projections */}
      {activeView === 'board' && (
        <>
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

          {/* Interactive Kanban Board Canvas */}
          <BoardCanvas
            board={board}
            workspaceId={wid}
            members={members}
            filterQuery={filterQuery}
            filterLabelIds={filterLabelIds}
            filterAssigneeId={filterAssigneeId}
            onBoardUpdated={loadBoard}
          />
        </>
      )}

      {activeView === 'table' && (
        <TableView
          key={`table-${refreshKey}`}
          workspaceId={wid}
          boardId={bid}
          members={members}
          onBoardUpdated={loadBoard}
          hasUpdates={hasViewUpdates}
          onRefresh={handleRefreshView}
        />
      )}

      {activeView === 'calendar' && (
        <CalendarView
          key={`calendar-${refreshKey}`}
          workspaceId={wid}
          boardId={bid}
          members={members}
          onBoardUpdated={loadBoard}
          hasUpdates={hasViewUpdates}
          onRefresh={handleRefreshView}
        />
      )}

      {activeView === 'timeline' && (
        <TimelineView
          key={`timeline-${refreshKey}`}
          workspaceId={wid}
          boardId={bid}
          members={members}
          onBoardUpdated={loadBoard}
          hasUpdates={hasViewUpdates}
          onRefresh={handleRefreshView}
        />
      )}

      {/* Deep-linked Card Modal */}
      {deepLinkedCard && (
        <CardModal
          card={deepLinkedCard}
          workspaceId={wid}
          boardId={bid}
          members={members}
          isOpen={!!deepLinkedCard}
          onClose={handleCloseDeepLinkedCard}
          onCardUpdated={() => {
            void loadBoard()
            if (cardId) {
              void cardApi.getDetails(wid, bid, cardId).then((r) => r.success && r.data && setDeepLinkedCard(r.data))
            }
          }}
          initialTab={commentId ? 'comments' : 'overview'}
        />
      )}

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
