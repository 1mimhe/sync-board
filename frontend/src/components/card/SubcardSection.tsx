import { useEffect, useState, useCallback } from 'react'
import type { Card, CardWithSubcards, CardPriority, CardStatus } from '../../types'
import { cardApi } from '../../api/endpoints'
import { useToast } from '../../stores/toast.store'
import {
  IconPlus,
  IconTrash,
  IconSubtask,
  IconCheck,
  IconFlag,
} from '../common/Icons'

export interface SubcardSectionProps {
  workspaceId: string
  boardId: string
  parentCard: Card
  onCardUpdated: () => void
  onOpenCard?: (card: Card) => void
  allBoardCards?: Card[]
}

const PRIORITY_COLORS: Record<CardPriority, { color: string; label: string }> = {
  lowest: { color: '#71717a', label: 'Lowest' },
  low: { color: '#3b82f6', label: 'Low' },
  medium: { color: '#f59e0b', label: 'Medium' },
  high: { color: '#f97316', label: 'High' },
  urgent: { color: '#ef4444', label: 'Urgent' },
}

const STATUS_LABELS: Record<CardStatus, { label: string; bg: string; color: string }> = {
  not_started: { label: 'To Do', bg: 'rgba(113, 113, 122, 0.15)', color: '#a1a1aa' },
  active: { label: 'Active', bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' },
  done: { label: 'Done', bg: 'rgba(16, 185, 129, 0.15)', color: '#34d399' },
  closed: { label: 'Closed', bg: 'rgba(124, 58, 237, 0.15)', color: '#c084fc' },
}

export function SubcardSection({
  workspaceId,
  boardId,
  parentCard,
  onCardUpdated,
  onOpenCard,
  allBoardCards = [],
}: SubcardSectionProps) {
  const { addToast } = useToast()
  const [data, setData] = useState<CardWithSubcards | null>(null)
  const [loading, setLoading] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [showAttach, setShowAttach] = useState(false)
  const [selectedToAttach, setSelectedToAttach] = useState('')

  const loadSubcards = useCallback(async () => {
    setLoading(true)
    const res = await cardApi.getWithSubcards(workspaceId, boardId, parentCard.id)
    if (res.success && res.data) {
      setData(res.data)
    }
    setLoading(false)
  }, [workspaceId, boardId, parentCard.id])

  useEffect(() => {
    loadSubcards()
  }, [loadSubcards])

  const handleCreateSubcard = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = newTitle.trim()
    if (!trimmed) return

    const tempId = `temp-${Date.now()}`
    const optimisticSubcard: Card = {
      id: tempId,
      title: trimmed,
      status: 'not_started',
      priority: 'medium',
      isComplete: false,
      parentCardId: parentCard.id,
      listId: parentCard.listId,
      rank: '0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // 1. Instant optimistic state update
    setData((prev) => {
      const existing = prev?.subcards || []
      const nextSubcards = [...existing, optimisticSubcard]
      const doneCount = nextSubcards.filter((s) => s.isComplete || s.status === 'done').length
      return {
        ...(prev || { id: parentCard.id }),
        subcards: nextSubcards,
        rollup: {
          totalSubcards: nextSubcards.length,
          completedSubcards: doneCount,
        },
      } as CardWithSubcards
    })

    // Clear input immediately so user can type the next subtask without delay
    setNewTitle('')

    // 2. Network call in background
    try {
      const res = await cardApi.createSubcard(workspaceId, boardId, parentCard.id, {
        title: trimmed,
      })

      if (res.success && res.data) {
        const serverCard = res.data
        setData((prev) => {
          if (!prev) return null
          return {
            ...prev,
            subcards: prev.subcards.map((s) => (s.id === tempId ? serverCard : s)),
          }
        })
        onCardUpdated()
      } else {
        // Revert on error
        setData((prev) => {
          if (!prev) return null
          const filtered = prev.subcards.filter((s) => s.id !== tempId)
          const doneCount = filtered.filter((s) => s.isComplete || s.status === 'done').length
          return {
            ...prev,
            subcards: filtered,
            rollup: {
              totalSubcards: filtered.length,
              completedSubcards: doneCount,
            },
          }
        })
        addToast(res.error?.message || 'Failed to create subcard', 'error')
      }
    } catch {
      setData((prev) => {
        if (!prev) return null
        const filtered = prev.subcards.filter((s) => s.id !== tempId)
        return {
          ...prev,
          subcards: filtered,
          rollup: {
            totalSubcards: filtered.length,
            completedSubcards: filtered.filter((s) => s.isComplete || s.status === 'done').length,
          },
        }
      })
      addToast('Failed to create subcard', 'error')
    }
  }

  const handleAttachSubcard = async () => {
    if (!selectedToAttach) return
    const cardToAttach = allBoardCards.find((c) => c.id === selectedToAttach)
    if (cardToAttach) {
      setData((prev) => {
        const existing = prev?.subcards || []
        const nextSubcards = [...existing, cardToAttach]
        return {
          ...(prev || { id: parentCard.id }),
          subcards: nextSubcards,
          rollup: {
            totalSubcards: nextSubcards.length,
            completedSubcards: nextSubcards.filter((s) => s.isComplete || s.status === 'done').length,
          },
        } as CardWithSubcards
      })
    }
    setSelectedToAttach('')
    setShowAttach(false)

    const res = await cardApi.attachSubcard(
      workspaceId,
      boardId,
      parentCard.id,
      selectedToAttach,
    )
    if (res.success) {
      addToast('Subcard attached', 'success')
      onCardUpdated()
    } else {
      addToast(res.error?.message || 'Failed to attach subcard', 'error')
      loadSubcards()
    }
  }

  const handleDetachSubcard = async (subcardId: string) => {
    // Instant optimistic removal
    setData((prev) => {
      if (!prev) return null
      const filtered = prev.subcards.filter((s) => s.id !== subcardId)
      return {
        ...prev,
        subcards: filtered,
        rollup: {
          totalSubcards: filtered.length,
          completedSubcards: filtered.filter((s) => s.isComplete || s.status === 'done').length,
        },
      }
    })
    addToast('Subcard detached', 'info')

    const res = await cardApi.detachSubcard(workspaceId, boardId, subcardId)
    if (res.success) {
      onCardUpdated()
    } else {
      addToast(res.error?.message || 'Failed to detach subcard', 'error')
      loadSubcards()
    }
  }

  const handleToggleSubcardComplete = async (subcard: Card) => {
    const isNowDone = !subcard.isComplete && !subcard.isCompleted
    const targetStatus: CardStatus = isNowDone ? 'done' : 'not_started'

    // Instant optimistic update
    setData((prev) => {
      if (!prev) return null
      const updated = prev.subcards.map((s) =>
        s.id === subcard.id
          ? { ...s, isComplete: isNowDone, isCompleted: isNowDone, status: targetStatus }
          : s
      )
      return {
        ...prev,
        subcards: updated,
        rollup: {
          totalSubcards: updated.length,
          completedSubcards: updated.filter((s) => s.isComplete || s.status === 'done').length,
        },
      }
    })

    const res = await cardApi.updateStatus(workspaceId, boardId, subcard.id, {
      status: targetStatus,
    })
    if (res.success) {
      onCardUpdated()
    } else {
      loadSubcards()
      addToast(res.error?.message || 'Failed to update subcard status', 'error')
    }
  }

  const subcards = data?.subcards || []
  const rollup = data?.rollup || {
    totalSubcards: subcards.length,
    completedSubcards: subcards.filter((s) => s.isComplete || s.isCompleted).length,
  }

  const percent =
    rollup.totalSubcards > 0
      ? Math.round((rollup.completedSubcards / rollup.totalSubcards) * 100)
      : 0

  const parentOfThisCard = parentCard.parentCardId
    ? allBoardCards.find((c) => c.id === parentCard.parentCardId)
    : undefined

  const handleDetachSelf = async () => {
    const res = await cardApi.detachSubcard(workspaceId, boardId, parentCard.id)
    if (res.success) {
      addToast('Card detached from parent (now a top-level card)', 'success')
      onCardUpdated()
    } else {
      addToast(res.error?.message || 'Failed to detach from parent', 'error')
    }
  }

  // If this card is already a subtask, it cannot have nested subcards (max depth 2)
  if (parentCard.parentCardId) {
    return (
      <div
        className="card"
        style={{
          padding: 24,
          background: 'rgba(124, 58, 237, 0.04)',
          border: '1px dashed rgba(124, 58, 237, 0.3)',
          borderRadius: 12,
          textAlign: 'center',
          display: 'grid',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--violet2)' }}>
          <IconSubtask size={24} />
          <span style={{ fontSize: 15, fontWeight: 700 }}>Maximum Subtask Depth (Level 2)</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
          This card is already a subtask{parentOfThisCard ? ` of "${parentOfThisCard.title}"` : ''}.
          SyncBoard enforces a maximum hierarchy depth of 2 levels, so subtasks cannot have nested subtasks.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
          {parentOfThisCard && onOpenCard && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onOpenCard(parentOfThisCard)}
            >
              Go to Parent Card ({parentOfThisCard.title}) &rarr;
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ color: '#f87171' }}
            onClick={handleDetachSelf}
          >
            Detach from Parent (Make Top-Level)
          </button>
        </div>
      </div>
    )
  }

  // Filter cards that can be attached (not parent itself, not already attached, not having parent, and having no subcards)
  const attachableCards = allBoardCards.filter(
    (c) =>
      c.id !== parentCard.id &&
      !c.parentCardId &&
      !c.subcards?.length &&
      !subcards.some((s) => s.id === c.id),
  )

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* Header & Progress */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconSubtask size={16} style={{ color: 'var(--violet)' }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
            Subtasks
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 20,
              background: 'var(--bg4)',
              color: 'var(--muted)',
            }}
          >
            {rollup.completedSubcards}/{rollup.totalSubcards}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setIsAdding(!isAdding)}
          >
            <IconPlus size={14} /> Add Subtask
          </button>
          {attachableCards.length > 0 && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShowAttach(!showAttach)}
            >
              Attach Existing
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {rollup.totalSubcards > 0 && (
        <div
          style={{
            height: 6,
            background: 'var(--bg4)',
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${percent}%`,
              background: percent === 100 ? 'var(--emerald)' : 'var(--violet)',
              transition: 'width 0.25s ease',
            }}
          />
        </div>
      )}

      {/* Quick Add Form */}
      {isAdding && (
        <form
          onSubmit={handleCreateSubcard}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            background: 'var(--bg3)',
            padding: 10,
            borderRadius: 'var(--radius2)',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setIsAdding(false)
                  setNewTitle('')
                }
              }}
              placeholder="Type subtask title and press Enter…"
              style={{ flex: 1, fontSize: 13 }}
            />
            <button type="submit" className="btn btn-primary btn-sm" disabled={!newTitle.trim()}>
              Add
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setIsAdding(false)
                setNewTitle('')
              }}
            >
              Done
            </button>
          </div>
          <span style={{ fontSize: 10.5, color: 'var(--muted2)' }}>
            Tip: Press <kbd style={{ padding: '1px 4px', background: 'var(--bg4)', borderRadius: 3 }}>Enter</kbd> to add and immediately type the next subtask, <kbd style={{ padding: '1px 4px', background: 'var(--bg4)', borderRadius: 3 }}>Esc</kbd> to finish.
          </span>
        </form>
      )}

      {/* Attach Existing Form */}
      {showAttach && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            background: 'var(--bg3)',
            padding: 10,
            borderRadius: 'var(--radius2)',
            border: '1px solid var(--border)',
            alignItems: 'center',
          }}
        >
          <select
            value={selectedToAttach}
            onChange={(e) => setSelectedToAttach(e.target.value)}
            style={{ flex: 1, fontSize: 13, background: 'var(--bg2)', color: 'var(--text)' }}
          >
            <option value="">Select a card from this board…</option>
            {attachableCards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!selectedToAttach}
            onClick={handleAttachSubcard}
          >
            Attach
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setShowAttach(false)}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Subcard Items List */}
      {loading && subcards.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 0' }}>
          Loading subtasks…
        </div>
      ) : subcards.length === 0 && !isAdding ? (
        <div
          style={{
            fontSize: 12,
            color: 'var(--muted2)',
            padding: '12px 14px',
            background: 'var(--bg3)',
            borderRadius: 'var(--radius2)',
            textAlign: 'center',
          }}
        >
          No subtasks yet. Break this task into smaller steps.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {subcards.map((sub) => {
            const isDone = sub.isComplete || sub.isCompleted
            const pConfig = sub.priority ? PRIORITY_COLORS[sub.priority] : null
            const sBadge = sub.status ? STATUS_LABELS[sub.status] : null

            return (
              <div
                key={sub.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: 'var(--bg3)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius2)',
                  gap: 10,
                  transition: 'background 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                  <button
                    type="button"
                    onClick={() => handleToggleSubcardComplete(sub)}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      border: isDone ? 'none' : '1.5px solid var(--muted2)',
                      background: isDone ? 'var(--emerald)' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: '#fff',
                      padding: 0,
                      flexShrink: 0,
                    }}
                    title={isDone ? 'Mark incomplete' : 'Mark complete'}
                  >
                    {isDone && <IconCheck size={12} />}
                  </button>

                  <span
                    onClick={() => onOpenCard?.(sub)}
                    style={{
                      fontSize: 13,
                      color: isDone ? 'var(--muted)' : 'var(--text)',
                      textDecoration: isDone ? 'line-through' : 'none',
                      cursor: onOpenCard ? 'pointer' : 'default',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                    }}
                    title={sub.title}
                  >
                    {sub.title}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {pConfig && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: pConfig.color,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                      }}
                      title={`Priority: ${pConfig.label}`}
                    >
                      <IconFlag size={12} />
                      {pConfig.label}
                    </span>
                  )}

                  {sBadge && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: 4,
                        background: sBadge.bg,
                        color: sBadge.color,
                      }}
                    >
                      {sBadge.label}
                    </span>
                  )}

                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ padding: 4, color: 'var(--muted2)' }}
                    onClick={() => handleDetachSubcard(sub.id)}
                    title="Detach from parent"
                  >
                    <IconTrash size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
