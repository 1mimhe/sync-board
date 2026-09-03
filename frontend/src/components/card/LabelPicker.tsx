import React, { useState } from 'react'
import type { BoardLabel, CardLabel } from '../../types'
import { cardApi, labelApi } from '../../api/endpoints'
import { useToast } from '../../stores/toast.store'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { IconTag, IconCheck, IconPlus, IconSearch, IconEdit, IconTrash } from '../common/Icons'

export interface LabelPickerProps {
  workspaceId: string
  boardId: string
  cardId: string
  cardLabels: (CardLabel | BoardLabel)[]
  boardLabels: BoardLabel[]
  onUpdated: () => void
}

const PRESET_COLORS = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#10b981',
  '#06b6d4',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#71717a',
]

export function LabelPicker({
  workspaceId,
  boardId,
  cardId,
  cardLabels,
  boardLabels,
  onUpdated,
}: LabelPickerProps) {
  const { addToast } = useToast()
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // New label creation state
  const [newLabelName, setNewLabelName] = useState('')
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0])
  const [isCreating, setIsCreating] = useState(false)

  // Edit label state
  const [editingLabel, setEditingLabel] = useState<BoardLabel | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState(PRESET_COLORS[0])
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [labelToDelete, setLabelToDelete] = useState<BoardLabel | null>(null)

  const isAttached = (labelId: string) => {
    return cardLabels.some((l) =>
      'labelId' in l ? l.labelId === labelId : (l as BoardLabel).id === labelId,
    )
  }

  // Get full objects of all labels attached to THIS card
  const attachedLabels: BoardLabel[] = cardLabels
    .map((cl) => {
      const lid = 'labelId' in cl ? cl.labelId : (cl as BoardLabel).id
      const full = boardLabels.find((b) => b.id === lid)
      if (full) return full
      if ('label' in cl && cl.label) return cl.label
      return cl as unknown as BoardLabel
    })
    .filter((l) => l && l.id)

  const handleDetachLabel = async (labelId: string) => {
    await cardApi.removeLabel(workspaceId, boardId, cardId, labelId)
    onUpdated()
  }

  const handleToggleLabel = async (label: BoardLabel) => {
    const attached = isAttached(label.id)
    if (attached) {
      await cardApi.removeLabel(workspaceId, boardId, cardId, label.id)
    } else {
      await cardApi.addLabel(workspaceId, boardId, cardId, label.id)
    }
    onUpdated()
  }

  const handleCreateLabel = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = (newLabelName.trim() || searchQuery.trim())
    if (!name) return

    setIsCreating(true)
    const res = await labelApi.createWorkspaceLabel(workspaceId, {
      name,
      color: selectedColor,
      cardId,
    })
    setIsCreating(false)

    if (res.success && res.data) {
      setNewLabelName('')
      setSearchQuery('')
      setShowCreateForm(false)
      addToast('Label created & attached to card', 'success')
      onUpdated()
    } else {
      addToast(res.error?.message || 'Failed to create label', 'error')
    }
  }

  const handleStartEdit = (label: BoardLabel, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingLabel(label)
    setEditName(label.name || '')
    setEditColor(label.color)
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingLabel || !editName.trim()) return

    setIsSavingEdit(true)
    const res = await labelApi.updateLabel(workspaceId, boardId, editingLabel.id, {
      name: editName.trim(),
      color: editColor,
    })
    setIsSavingEdit(false)

    if (res.success) {
      setEditingLabel(null)
      addToast('Label definition updated', 'success')
      onUpdated()
    } else {
      addToast(res.error?.message || 'Failed to update label', 'error')
    }
  }

  const handleDeleteLabel = (label: BoardLabel, e: React.MouseEvent) => {
    e.stopPropagation()
    setLabelToDelete(label)
  }

  const confirmDeleteLabel = async () => {
    if (!labelToDelete) return
    const res = await labelApi.deleteLabel(workspaceId, boardId, labelToDelete.id)
    if (res.success) {
      addToast('Label deleted', 'info')
      if (editingLabel?.id === labelToDelete.id) setEditingLabel(null)
      onUpdated()
    } else {
      addToast(res.error?.message || 'Failed to delete label', 'error')
    }
    setLabelToDelete(null)
  }

  // Filter available labels by search query
  const filteredLabels = boardLabels.filter((lb) => {
    if (!searchQuery.trim()) return true
    return (lb.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  })

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {/* Header and Add / Manage Button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--muted)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <IconTag size={15} /> Card Labels
        </span>
        <button
          type="button"
          className={`btn btn-sm ${isPickerOpen ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => {
            setIsPickerOpen(!isPickerOpen)
            setShowCreateForm(false)
            setEditingLabel(null)
          }}
          style={{ fontSize: 11.5, padding: '2px 8px', gap: 4 }}
        >
          <IconPlus size={12} /> {isPickerOpen ? 'Done' : 'Attach / Create'}
        </button>
      </div>

      {/* 1. Attached Labels on THIS Card */}
      {attachedLabels.length > 0 ? (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {attachedLabels.map((lb) => (
            <span
              key={lb.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                borderRadius: 16,
                background: `${lb.color}20`,
                border: `1px solid ${lb.color}88`,
                color: lb.color,
                padding: '2px 8px 2px 10px',
                fontSize: 11.5,
                fontWeight: 700,
                boxShadow: `0 2px 8px ${lb.color}22`,
                transition: 'all 0.15s ease',
              }}
            >
              {lb.name}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleDetachLabel(lb.id)
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: lb.color,
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: 12,
                  opacity: 0.7,
                  marginLeft: 2,
                }}
                title="Remove label from this card"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      ) : (
        !isPickerOpen && (
          <div style={{ fontSize: 12, color: 'var(--muted2)', padding: '2px 0' }}>
            No labels attached to this card. Click{' '}
            <strong
              style={{ color: 'var(--primary)', cursor: 'pointer' }}
              onClick={() => setIsPickerOpen(true)}
            >
              Attach / Create
            </strong>{' '}
            to add one.
          </div>
        )
      )}

      {/* 2. Attach / Search & Create Panel (Openable) */}
      {isPickerOpen && (
        <div
          style={{
            background: 'var(--bg2)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 12,
            display: 'grid',
            gap: 12,
            boxShadow: '0 6px 24px rgba(0,0,0,0.3)',
          }}
        >
          {/* Search Input */}
          <div style={{ position: 'relative' }}>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search labels to attach or create…"
              style={{ fontSize: 12, paddingLeft: 28, height: 32, width: '100%' }}
              autoFocus
            />
            <span style={{ position: 'absolute', left: 8, top: 8, color: 'var(--muted2)' }}>
              <IconSearch size={14} />
            </span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: 8,
                  background: 'none',
                  border: 'none',
                  color: 'var(--muted2)',
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Create CTA if query doesn't match exactly */}
          {searchQuery.trim() && !filteredLabels.some((l) => l.name?.toLowerCase() === searchQuery.trim().toLowerCase()) && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                setNewLabelName(searchQuery.trim())
                setShowCreateForm(true)
              }}
              style={{ justifyContent: 'flex-start', fontSize: 12, gap: 6 }}
            >
              <IconPlus size={13} /> Create new label "{searchQuery.trim()}" & attach
            </button>
          )}

          {/* Unified Labels List */}
          {filteredLabels.length > 0 && (
            <div style={{ display: 'grid', gap: 6, maxHeight: 260, overflowY: 'auto', paddingRight: 2 }}>
              {filteredLabels.map((lb) => {
                const active = isAttached(lb.id)
                return (
                  <div
                    key={lb.id}
                    onClick={() => handleToggleLabel(lb)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 10px',
                      borderRadius: 8,
                      background: active ? `${lb.color}15` : 'var(--bg3)',
                      border: `1px solid ${active ? `${lb.color}55` : 'var(--border)'}`,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    title="Click to toggle attachment to this card"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                      {/* Selection Box */}
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 4,
                          border: active ? `1.5px solid ${lb.color}` : '1.5px solid var(--border)',
                          background: active ? lb.color : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          flexShrink: 0,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {active && <IconCheck size={11} />}
                      </div>

                      {/* Label color pill */}
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          background: `${lb.color}20`,
                          border: `1px solid ${lb.color}60`,
                          color: lb.color,
                          fontSize: 12,
                          fontWeight: active ? 700 : 600,
                          padding: '2px 8px',
                          borderRadius: 14,
                          letterSpacing: '0.01em',
                          maxWidth: '100%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: lb.color,
                            flexShrink: 0,
                          }}
                        />
                        {lb.name}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={(e) => handleStartEdit(lb, e)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--muted2)',
                          cursor: 'pointer',
                          padding: '3px 5px',
                          borderRadius: 4,
                          display: 'flex',
                          alignItems: 'center',
                        }}
                        title="Edit label definition"
                      >
                        <IconEdit size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteLabel(lb, e)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#f87171',
                          cursor: 'pointer',
                          padding: '3px 5px',
                          borderRadius: 4,
                          display: 'flex',
                          alignItems: 'center',
                        }}
                        title="Delete label"
                      >
                        <IconTrash size={12} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* If no labels exist yet */}
          {filteredLabels.length === 0 && !searchQuery.trim() && (
            <div style={{ fontSize: 12, color: 'var(--muted2)', textAlign: 'center', padding: '8px 0' }}>
              No labels created yet on this board or workspace.
            </div>
          )}

          {/* Toggle Create Form Button */}
          {!showCreateForm ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setShowCreateForm(true)
                setNewLabelName(searchQuery.trim())
              }}
              style={{ justifyContent: 'flex-start', fontSize: 12, gap: 6, color: 'var(--primary)' }}
            >
              <IconPlus size={13} /> Create new label
            </button>
          ) : (
            /* Create Label Inline Subform */
            <form
              onSubmit={handleCreateLabel}
              style={{
                background: 'var(--bg3)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: 10,
                display: 'grid',
                gap: 10,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                New Label Details
              </div>

              <input
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                placeholder="Label name (e.g. Bug, Feature, Urgent)…"
                required
                style={{ fontSize: 12 }}
                autoFocus
              />

              {/* Color Swatches */}
              <div style={{ display: 'grid', gap: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Select Color:</span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSelectedColor(c)}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: c,
                        border: selectedColor === c ? '2px solid #fff' : '2px solid transparent',
                        cursor: 'pointer',
                        boxShadow: selectedColor === c ? `0 0 8px ${c}` : 'none',
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Submit / Cancel buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowCreateForm(false)}
                  style={{ fontSize: 11.5 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={isCreating || !newLabelName.trim()}
                  style={{ fontSize: 11.5 }}
                >
                  {isCreating ? 'Creating…' : 'Create & Attach'}
                </button>
              </div>
            </form>
          )}

          {/* Edit Label Inline Subform */}
          {editingLabel && (
            <form
              onSubmit={handleSaveEdit}
              style={{
                background: 'var(--bg3)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: 10,
                display: 'grid',
                gap: 10,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                Edit Label Definition
              </div>

              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Label name…"
                required
                style={{ fontSize: 12 }}
                autoFocus
              />

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setEditColor(c)}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: c,
                      border: editColor === c ? '2px solid #fff' : '2px solid transparent',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setEditingLabel(null)}
                  style={{ fontSize: 11.5 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={isSavingEdit || !editName.trim()}
                  style={{ fontSize: 11.5 }}
                >
                  {isSavingEdit ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Delete Label Confirmation Dialog */}
      {labelToDelete && (
        <ConfirmDialog
          isOpen={!!labelToDelete}
          onClose={() => setLabelToDelete(null)}
          onConfirm={confirmDeleteLabel}
          title="Delete Label"
          message={`Are you sure you want to permanently delete "${labelToDelete.name}"? This removes it from all cards.`}
          confirmLabel="Delete Label"
          confirmVariant="danger"
        />
      )}
    </div>
  )
}
