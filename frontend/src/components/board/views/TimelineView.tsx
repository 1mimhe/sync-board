import { useEffect, useState, useCallback } from 'react'
import type { Card, CardPriority, CardStatus, WorkspaceMember } from '../../../types'
import { boardViewApi } from '../../../api/endpoints'
import { CardModal } from '../../card/CardModal'
import { IconFlag, IconCalendar, IconCheck } from '../../common/Icons'

export interface TimelineViewProps {
  workspaceId: string
  boardId: string
  members: WorkspaceMember[]
  onBoardUpdated: () => void
}

const PRIORITY_COLORS: Record<CardPriority, string> = {
  lowest: '#71717a',
  low: '#3b82f6',
  medium: '#f59e0b',
  high: '#f97316',
  urgent: '#ef4444',
}

const STATUS_LABELS: Record<CardStatus, { label: string; bg: string; color: string }> = {
  not_started: { label: 'To Do', bg: 'rgba(113, 113, 122, 0.15)', color: '#a1a1aa' },
  active: { label: 'Active', bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' },
  done: { label: 'Done', bg: 'rgba(16, 185, 129, 0.15)', color: '#34d399' },
  closed: { label: 'Closed', bg: 'rgba(124, 58, 237, 0.15)', color: '#c084fc' },
}

export function TimelineView({
  workspaceId,
  boardId,
  members,
  onBoardUpdated,
}: TimelineViewProps) {
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedCard, setSelectedCard] = useState<Card | null>(null)

  const loadTimelineData = useCallback(async () => {
    setLoading(true)
    const res = await boardViewApi.timeline(workspaceId, boardId, { limit: 100 })
    if (res.success && res.data) {
      setCards(res.data.items || [])
    }
    setLoading(false)
  }, [workspaceId, boardId])

  useEffect(() => {
    loadTimelineData()
  }, [loadTimelineData])

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* Header Info */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg2)',
          padding: '10px 16px',
          borderRadius: 'var(--radius2)',
          border: '1px solid var(--border)',
        }}
      >
        <div>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
            Timeline Roadmap
          </span>
          <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 8 }}>
            Chronological task schedule and delivery milestones
          </span>
        </div>
        <span style={{ fontSize: 12, color: 'var(--muted2)' }}>
          {cards.length} scheduled item{cards.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Timeline Stream */}
      <div
        style={{
          background: 'var(--bg2)',
          borderRadius: 'var(--radius2)',
          border: '1px solid var(--border)',
          padding: 16,
          display: 'grid',
          gap: 10,
          boxShadow: 'var(--shadow)',
        }}
      >
        {loading && cards.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>
            Loading timeline…
          </div>
        ) : cards.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted2)' }}>
            No cards found for timeline view.
          </div>
        ) : (
          <div style={{ position: 'relative', display: 'grid', gap: 10 }}>
            {cards.map((card) => {
              const isDone = card.isComplete || card.isCompleted
              const priorityColor = card.priority ? PRIORITY_COLORS[card.priority] : '#f59e0b'
              const statusBadge = card.status ? STATUS_LABELS[card.status] : null
              const isOverdue = card.dueDate && new Date(card.dueDate) < new Date() && !isDone

              return (
                <div
                  key={card.id}
                  onClick={() => setSelectedCard(card)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: 'var(--bg3)',
                    borderRadius: 'var(--radius2)',
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                    gap: 16,
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border2)'
                    e.currentTarget.style.transform = 'translateX(2px)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)'
                    e.currentTarget.style.transform = 'none'
                  }}
                >
                  {/* Left: Indicator & Title */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: priorityColor,
                        flexShrink: 0,
                      }}
                      title={`Priority: ${card.priority || 'medium'}`}
                    />

                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13.5,
                          fontWeight: 700,
                          color: isDone ? 'var(--muted)' : 'var(--text)',
                          textDecoration: isDone ? 'line-through' : 'none',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {card.title}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--muted2)', marginTop: 2 }}>
                        <span>Created {new Date(card.createdAt).toLocaleDateString()}</span>
                        {card.dueDate && (
                          <span style={{ color: isOverdue ? '#f87171' : 'var(--muted)', fontWeight: isOverdue ? 700 : 400 }}>
                            • Due {new Date(card.dueDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Badges */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {statusBadge && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: statusBadge.bg,
                          color: statusBadge.color,
                        }}
                      >
                        {statusBadge.label}
                      </span>
                    )}

                    {card.priority && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: priorityColor,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <IconFlag size={12} />
                        {card.priority}
                      </span>
                    )}

                    {card.dueDate && (
                      <span
                        style={{
                          fontSize: 11,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          color: isOverdue ? '#f87171' : 'var(--muted)',
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: isOverdue ? 'rgba(239, 68, 68, 0.12)' : 'var(--bg4)',
                        }}
                      >
                        <IconCalendar size={11} />
                        {new Date(card.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    )}

                    {isDone && (
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 11,
                          fontWeight: 700,
                          color: 'var(--emerald)',
                        }}
                      >
                        <IconCheck size={13} /> Completed
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
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
            loadTimelineData()
            onBoardUpdated()
          }}
        />
      )}
    </div>
  )
}
