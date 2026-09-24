import { useEffect, useState, useCallback } from 'react'
import type { CardWithDetails, Card, CardStatus, CardPriority, WorkspaceMember } from '../../../types'
import { CARD_PRIORITY_META, CARD_STATUS_META } from '../../../constants'
import { boardViewApi, cardApi } from '../../../api/endpoints'
import { CardModal } from '../../card/CardModal'
import { Avatar } from '../../common/Avatar'
import {
  IconFlag,
  IconClock,
  IconCalendar,
  IconCheck,
  IconSubtask,
  IconSearch,
} from '../../common/Icons'

export interface TableViewProps {
  workspaceId: string
  boardId: string
  members: WorkspaceMember[]
  onBoardUpdated: () => void
  /** Set when a card:* WS event arrives while this read-only view is active. */
  hasUpdates?: boolean
  /** Reload the view (clears the Updated badge). */
  onRefresh?: () => void
}

function formatMinutes(mins: number): string {
  if (!mins || mins <= 0) return '0m'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

export function TableView({
  workspaceId,
  boardId,
  members,
  onBoardUpdated,
  hasUpdates,
  onRefresh,
}: TableViewProps) {
  const [cards, setCards] = useState<CardWithDetails[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedCard, setSelectedCard] = useState<Card | null>(null)

  // Filters & Sorting
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<CardStatus | ''>('')
  const [filterPriority, setFilterPriority] = useState<CardPriority | ''>('')
  const [filterAssigneeId, setFilterAssigneeId] = useState('')
  const [sortBy, setSortBy] = useState<'title' | 'dueDate' | 'priority' | 'status' | 'createdAt'>('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const loadTableData = useCallback(async () => {
    setLoading(true)
    const res = await boardViewApi.table(workspaceId, boardId, {
      search: search.trim() || undefined,
      status: filterStatus || undefined,
      priority: filterPriority || undefined,
      assigneeId: filterAssigneeId || undefined,
      sortBy,
      sortOrder,
      limit: 100,
    })
    if (res.success && res.data) {
      setCards(res.data.items || [])
    }
    setLoading(false)
  }, [workspaceId, boardId, search, filterStatus, filterPriority, filterAssigneeId, sortBy, sortOrder])

  useEffect(() => {
    loadTableData()
  }, [loadTableData])

  const handleToggleDone = async (e: React.MouseEvent, card: CardWithDetails) => {
    e.stopPropagation()
    const isNowDone = !card.isComplete && !card.isCompleted
    const targetStatus: CardStatus = isNowDone ? 'done' : 'not_started'
    const res = await cardApi.updateStatus(workspaceId, boardId, card.id, {
      status: targetStatus,
    })
    if (res.success) {
      loadTableData()
      onBoardUpdated()
    }
  }

  const handleSort = (col: typeof sortBy) => {
    if (sortBy === col) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(col)
      setSortOrder('asc')
    }
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {hasUpdates && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            background: 'rgba(245,158,11,0.12)',
            border: '1px solid rgba(245,158,11,0.4)',
            borderRadius: 10,
            padding: '8px 12px',
            fontSize: 12.5,
            color: '#fbbf24',
          }}
        >
          <span>Updated — refresh to see latest cards (read-only view, no live patch).</span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              onRefresh?.()
              void loadTableData()
            }}
          >
            Refresh
          </button>
        </div>
      )}
      {/* Table Filter Toolbar */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          flexWrap: 'wrap',
          background: 'var(--bg2)',
          padding: '10px 14px',
          borderRadius: 'var(--radius2)',
          border: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 200px' }}>
          <IconSearch size={15} style={{ color: 'var(--muted)' }} />
          <input
            type="text"
            placeholder="Search cards in table…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', fontSize: 13, background: 'transparent', border: 'none' }}
          />
        </div>

        {/* Status Filter */}
        <select
          aria-label="Filter by status"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as CardStatus | '')}
          style={{ fontSize: 12.5, padding: '4px 8px', background: 'var(--bg3)', color: 'var(--text)' }}
        >
          <option value="">All Statuses</option>
          <option value="not_started">{CARD_STATUS_META.not_started.label}</option>
          <option value="active">{CARD_STATUS_META.active.label}</option>
          <option value="done">{CARD_STATUS_META.done.label}</option>
          <option value="closed">{CARD_STATUS_META.closed.label}</option>
        </select>

        {/* Priority Filter */}
        <select
          aria-label="Filter by priority"
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value as CardPriority | '')}
          style={{ fontSize: 12.5, padding: '4px 8px', background: 'var(--bg3)', color: 'var(--text)' }}
        >
          <option value="">All Priorities</option>
          <option value="urgent">{CARD_PRIORITY_META.urgent.label}</option>
          <option value="high">{CARD_PRIORITY_META.high.label}</option>
          <option value="medium">{CARD_PRIORITY_META.medium.label}</option>
          <option value="low">{CARD_PRIORITY_META.low.label}</option>
          <option value="lowest">{CARD_PRIORITY_META.lowest.label}</option>
        </select>

        {/* Assignee Filter */}
        <select
          aria-label="Filter by assignee"
          value={filterAssigneeId}
          onChange={(e) => setFilterAssigneeId(e.target.value)}
          style={{ fontSize: 12.5, padding: '4px 8px', background: 'var(--bg3)', color: 'var(--text)', maxWidth: 160 }}
        >
          <option value="">All assignees</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.user.displayName}
            </option>
          ))}
        </select>

        <span style={{ fontSize: 12, color: 'var(--muted2)', marginLeft: 'auto' }}>
          {cards.length} card{cards.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Spreadsheet / Table Container */}
      <div
        style={{
          background: 'var(--bg2)',
          borderRadius: 'var(--radius2)',
          border: '1px solid var(--border)',
          overflow: 'auto',
          boxShadow: 'var(--shadow)',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead>
            <tr
              style={{
                background: 'var(--bg3)',
                borderBottom: '1px solid var(--border)',
                color: 'var(--muted)',
                fontSize: 12,
                userSelect: 'none',
              }}
            >
              <th style={{ padding: '10px 14px', width: 40 }}>#</th>
              <th
                onClick={() => handleSort('title')}
                style={{ padding: '10px 14px', cursor: 'pointer' }}
              >
                Task Title {sortBy === 'title' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th style={{ padding: '10px 14px', width: 130 }}>List</th>
              <th
                onClick={() => handleSort('status')}
                style={{ padding: '10px 14px', width: 110, cursor: 'pointer' }}
              >
                Status {sortBy === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th
                onClick={() => handleSort('priority')}
                style={{ padding: '10px 14px', width: 110, cursor: 'pointer' }}
              >
                Priority {sortBy === 'priority' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th style={{ padding: '10px 14px', width: 120 }}>Assignees</th>
              <th
                onClick={() => handleSort('dueDate')}
                style={{ padding: '10px 14px', width: 130, cursor: 'pointer' }}
              >
                Due Date {sortBy === 'dueDate' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th style={{ padding: '10px 14px', width: 120 }}>Time Tracked</th>
              <th style={{ padding: '10px 14px', width: 90 }}>Subtasks</th>
            </tr>
          </thead>
          <tbody>
            {loading && cards.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>
                  Loading table view data…
                </td>
              </tr>
            ) : cards.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: 32, textAlign: 'center', color: 'var(--muted2)' }}>
                  No cards found matching current filters.
                </td>
              </tr>
            ) : (
              cards.map((card) => {
                const isDone = card.isComplete || card.isCompleted
                const priorityMeta = card.priority ? CARD_PRIORITY_META[card.priority] : null
                const statusMeta = card.status ? CARD_STATUS_META[card.status] : null
                const isOverdue = card.dueDate && new Date(card.dueDate) < new Date() && !isDone
                const subcardsCount = card.subcards?.length || 0
                const doneSubcards = card.subcards?.filter((s) => s.isComplete || s.isCompleted).length || 0

                return (
                  <tr
                    key={card.id}
                    onClick={() => setSelectedCard(card)}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg3)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* Checkbox */}
                    <td style={{ padding: '10px 14px' }}>
                      <button
                        type="button"
                        onClick={(e) => handleToggleDone(e, card)}
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 4,
                          border: isDone ? 'none' : '1.5px solid var(--muted2)',
                          background: isDone ? 'var(--emerald)' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        {isDone && <IconCheck size={12} />}
                      </button>
                    </td>

                    {/* Title */}
                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {card.parentCardId && (
                          <span
                            className="badge"
                            style={{
                              fontSize: 10,
                              padding: '1px 5px',
                              background: 'rgba(124, 58, 237, 0.12)',
                              color: 'var(--violet2)',
                              borderColor: 'rgba(124, 58, 237, 0.3)',
                              gap: 3,
                            }}
                            title="Subtask"
                          >
                            <IconSubtask size={10} /> Subtask
                          </span>
                        )}
                        <span
                          style={{
                            color: isDone ? 'var(--muted)' : 'var(--text)',
                            textDecoration: isDone ? 'line-through' : 'none',
                          }}
                        >
                          {card.title}
                        </span>
                      </div>
                    </td>

                    {/* List */}
                    <td style={{ padding: '10px 14px', color: 'var(--muted)', fontSize: 12 }}>
                      {card.list?.title || '—'}
                    </td>

                    {/* Status */}
                    <td style={{ padding: '10px 14px' }}>
                      {statusMeta ? (
                        <span
                          title={statusMeta.label}
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: `${statusMeta.color}26`,
                            color: statusMeta.color,
                          }}
                        >
                          {statusMeta.label}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>

                    {/* Priority */}
                    <td style={{ padding: '10px 14px' }}>
                      {priorityMeta ? (
                        <span
                          title={priorityMeta.label}
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: priorityMeta.color,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <IconFlag size={12} />
                          {priorityMeta.label}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>

                    {/* Assignees */}
                    <td style={{ padding: '10px 14px' }}>
                      {card.assignees && card.assignees.length > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          {card.assignees.slice(0, 3).map((a, idx) => (
                            <div
                              key={a.userId}
                              style={{
                                marginLeft: idx === 0 ? 0 : -6,
                                borderRadius: '50%',
                                boxShadow: '0 0 0 2px var(--bg2)',
                              }}
                            >
                              <Avatar
                                name={a.user?.displayName || 'User'}
                                avatarUrl={a.user?.avatarUrl}
                                size={22}
                              />
                            </div>
                          ))}
                          {card.assignees.length > 3 && (
                            <span style={{ fontSize: 11, color: 'var(--muted2)', marginLeft: 4 }}>
                              +{card.assignees.length - 3}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--muted2)', fontSize: 12 }}>Unassigned</span>
                      )}
                    </td>

                    {/* Due Date */}
                    <td style={{ padding: '10px 14px' }}>
                      {card.dueDate ? (
                        <span
                          style={{
                            fontSize: 11.5,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            color: isOverdue ? '#f87171' : 'var(--muted)',
                            fontWeight: isOverdue ? 700 : 400,
                          }}
                        >
                          <IconCalendar size={12} />
                          {new Date(card.dueDate).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>

                    {/* Time Tracking */}
                    <td style={{ padding: '10px 14px', fontSize: 11.5, color: 'var(--muted)' }}>
                      {card.loggedMinutes !== undefined && card.loggedMinutes > 0 ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--violet2)' }}>
                          <IconClock size={12} />
                          {formatMinutes(card.loggedMinutes)}
                          {card.estimateMinutes ? ` / ${formatMinutes(card.estimateMinutes)}` : ''}
                        </span>
                      ) : card.estimateMinutes ? (
                        <span style={{ color: 'var(--muted2)' }}>Est: {formatMinutes(card.estimateMinutes)}</span>
                      ) : (
                        '—'
                      )}
                    </td>

                    {/* Subtasks */}
                    <td style={{ padding: '10px 14px', fontSize: 11.5 }}>
                      {subcardsCount > 0 ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            color: doneSubcards === subcardsCount ? 'var(--emerald)' : 'var(--muted)',
                          }}
                        >
                          <IconSubtask size={12} />
                          {doneSubcards}/{subcardsCount}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Card Detail Modal */}
      {selectedCard && (
        <CardModal
          card={selectedCard}
          workspaceId={workspaceId}
          boardId={boardId}
          members={members}
          allBoardCards={cards}
          isOpen={!!selectedCard}
          onClose={() => setSelectedCard(null)}
          onOpenCard={(c) => setSelectedCard(c)}
          onCardUpdated={() => {
            loadTableData()
            onBoardUpdated()
          }}
        />
      )}
    </div>
  )
}
