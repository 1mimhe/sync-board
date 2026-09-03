import React, { useState } from 'react'
import type { Checklist } from '../../types'
import { checklistApi } from '../../api/endpoints'
import { useToast } from '../../stores/toast.store'
import { IconCheckSquare, IconPlus, IconTrash } from '../common/Icons'

export interface ChecklistSectionProps {
  workspaceId: string
  boardId: string
  cardId: string
  checklists: Checklist[]
  onUpdated: () => void
}

export function ChecklistSection({
  workspaceId,
  boardId,
  cardId,
  checklists,
  onUpdated,
}: ChecklistSectionProps) {
  const { addToast } = useToast()
  const [newChecklistTitle, setNewChecklistTitle] = useState('')
  const [isAddingChecklist, setIsAddingChecklist] = useState(false)
  const [itemInputs, setItemInputs] = useState<Record<string, string>>({})

  const handleAddChecklist = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newChecklistTitle.trim()) return

    setIsAddingChecklist(true)
    const res = await checklistApi.createChecklist(workspaceId, boardId, cardId, {
      title: newChecklistTitle.trim(),
    })
    setIsAddingChecklist(false)

    if (res.success) {
      setNewChecklistTitle('')
      addToast('Checklist added', 'success')
      onUpdated()
    } else {
      addToast(res.error?.message || 'Failed to add checklist', 'error')
    }
  }

  const handleDeleteChecklist = async (checklistId: string) => {
    const res = await checklistApi.deleteChecklist(workspaceId, boardId, cardId, checklistId)
    if (res.success) {
      onUpdated()
    }
  }

  const handleToggleItem = async (
    checklistId: string,
    itemId: string,
    currentDone: boolean,
  ) => {
    await checklistApi.updateItem(workspaceId, boardId, cardId, checklistId, itemId, {
      isDone: !currentDone,
    })
    onUpdated()
  }

  const handleAddItem = async (e: React.FormEvent, checklistId: string) => {
    e.preventDefault()
    const content = (itemInputs[checklistId] || '').trim()
    if (!content) return

    const res = await checklistApi.addItem(workspaceId, boardId, cardId, checklistId, {
      content,
    })

    if (res.success) {
      setItemInputs((prev) => ({ ...prev, [checklistId]: '' }))
      onUpdated()
    }
  }

  const handleRemoveItem = async (checklistId: string, itemId: string) => {
    await checklistApi.removeItem(workspaceId, boardId, cardId, checklistId, itemId)
    onUpdated()
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Create New Checklist Header */}
      <form onSubmit={handleAddChecklist} style={{ display: 'flex', gap: 8 }}>
        <input
          value={newChecklistTitle}
          onChange={(e) => setNewChecklistTitle(e.target.value)}
          placeholder="New checklist title (e.g. Acceptance Criteria)…"
          style={{ flex: 1, fontSize: 13 }}
        />
        <button
          className="btn btn-primary btn-sm"
          type="submit"
          disabled={isAddingChecklist || !newChecklistTitle.trim()}
        >
          <IconPlus size={14} /> Add Checklist
        </button>
      </form>

      {/* Checklists List */}
      <div style={{ display: 'grid', gap: 16 }}>
        {checklists.map((cl) => {
          const items = cl.items || []
          const completedCount = items.filter((i) => i.isDone).length
          const percent = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0

          return (
            <div
              key={cl.id}
              className="card"
              style={{
                padding: 14,
                background: 'var(--bg3)',
                display: 'grid',
                gap: 12,
              }}
            >
              {/* Checklist Title & Actions */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <IconCheckSquare size={16} /> {cl.title}
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ color: '#f87171', padding: '4px 6px' }}
                  onClick={() => handleDeleteChecklist(cl.id)}
                  title="Delete checklist"
                >
                  <IconTrash size={14} />
                </button>
              </div>

              {/* Progress Bar */}
              {items.length > 0 && (
                <div style={{ display: 'grid', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)' }}>
                    <span>{percent}% completed</span>
                    <span>{completedCount}/{items.length}</span>
                  </div>
                  <div
                    style={{
                      height: 6,
                      background: 'rgba(255, 255, 255, 0.08)',
                      borderRadius: 999,
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
                </div>
              )}

              {/* Checklist Items */}
              <div style={{ display: 'grid', gap: 6 }}>
                {items.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '6px 10px',
                      background: 'rgba(0, 0, 0, 0.2)',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={item.isDone}
                      onChange={() => handleToggleItem(cl.id, item.id, item.isDone)}
                      style={{ cursor: 'pointer', accentColor: 'var(--violet)' }}
                    />
                    <span
                      style={{
                        flex: 1,
                        fontSize: 13,
                        textDecoration: item.isDone ? 'line-through' : 'none',
                        color: item.isDone ? 'var(--muted)' : 'var(--text)',
                      }}
                    >
                      {item.content}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(cl.id, item.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--muted2)',
                        cursor: 'pointer',
                        padding: 2,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              {/* Add Item Subform */}
              <form
                onSubmit={(e) => handleAddItem(e, cl.id)}
                style={{ display: 'flex', gap: 6 }}
              >
                <input
                  value={itemInputs[cl.id] || ''}
                  onChange={(e) =>
                    setItemInputs((prev) => ({ ...prev, [cl.id]: e.target.value }))
                  }
                  placeholder="Add item…"
                  style={{ flex: 1, fontSize: 12.5 }}
                />
                <button className="btn btn-sm" type="submit">
                  Add
                </button>
              </form>
            </div>
          )
        })}

        {checklists.length === 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--muted2)', textAlign: 'center', padding: 12 }}>
            No checklists yet. Add one above to track sub-tasks.
          </div>
        )}
      </div>
    </div>
  )
}
