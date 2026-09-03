import React, { useState } from 'react'
import type { BoardLabel } from '../../types'
import { labelApi } from '../../api/endpoints'
import { useToast } from '../../stores/toast.store'
import { Modal } from '../common/Modal'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { IconTag, IconPlus, IconSearch, IconEdit, IconTrash } from '../common/Icons'

export interface BoardLabelsModalProps {
  isOpen: boolean
  onClose: () => void
  workspaceId: string
  boardId: string
  labels: BoardLabel[]
  onLabelsUpdated: () => void
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

export function BoardLabelsModal({
  isOpen,
  onClose,
  workspaceId,
  boardId,
  labels,
  onLabelsUpdated,
}: BoardLabelsModalProps) {
  const { addToast } = useToast()
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])
  const [isCreating, setIsCreating] = useState(false)

  // Edit State
  const [editingLabel, setEditingLabel] = useState<BoardLabel | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState(PRESET_COLORS[0])
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [labelToDelete, setLabelToDelete] = useState<BoardLabel | null>(null)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setIsCreating(true)
    const res = await labelApi.createWorkspaceLabel(workspaceId, {
      name: name.trim(),
      color,
    })
    setIsCreating(false)

    if (res.success) {
      setName('')
      setShowCreate(false)
      addToast('Label created', 'success')
      onLabelsUpdated()
    } else {
      addToast(res.error?.message || 'Failed to create label', 'error')
    }
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
      addToast('Label updated', 'success')
      onLabelsUpdated()
    } else {
      addToast(res.error?.message || 'Failed to update label', 'error')
    }
  }

  const handleDelete = (label: BoardLabel) => {
    setLabelToDelete(label)
  }

  const confirmDeleteLabel = async () => {
    if (!labelToDelete) return
    const res = await labelApi.deleteLabel(workspaceId, boardId, labelToDelete.id)
    if (res.success) {
      addToast('Label deleted', 'info')
      if (editingLabel?.id === labelToDelete.id) setEditingLabel(null)
      onLabelsUpdated()
    } else {
      addToast(res.error?.message || 'Failed to delete label', 'error')
    }
    setLabelToDelete(null)
  }

  const filtered = labels.filter((lb) =>
    (lb.name || '').toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <>
      <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconTag size={18} /> Labels ({labels.length})
        </div>
      }
      maxWidth={540}
    >
      <div style={{ display: 'grid', gap: 16 }}>
        {/* Controls: Search and New Label Button */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search available labels…"
              style={{ width: '100%', paddingLeft: 32, fontSize: 13 }}
            />
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }}>
              <IconSearch size={14} />
            </span>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              setShowCreate(!showCreate)
              setEditingLabel(null)
            }}
          >
            <IconPlus size={14} /> {showCreate ? 'Cancel' : 'Create Label'}
          </button>
        </div>

        {/* Create Subform */}
        {showCreate && (
          <form
            onSubmit={handleCreate}
            style={{
              padding: 14,
              background: 'var(--bg3)',
              borderRadius: 12,
              border: '1px solid var(--border)',
              display: 'grid',
              gap: 12,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>
              Create New Available Label
            </div>

            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Label name (e.g. Bug, Feature, Urgent)…"
              style={{ fontSize: 13 }}
              required
              autoFocus
            />

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    backgroundColor: c,
                    border: color === c ? '2px solid #fff' : '2px solid transparent',
                    cursor: 'pointer',
                    outline: 'none',
                    transform: color === c ? 'scale(1.15)' : 'scale(1)',
                    transition: '0.15s',
                  }}
                />
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={isCreating || !name.trim()}
              >
                {isCreating ? 'Creating…' : 'Save Label'}
              </button>
            </div>
          </form>
        )}

        {/* Edit Subform */}
        {editingLabel && (
          <form
            onSubmit={handleSaveEdit}
            style={{
              padding: 14,
              background: 'var(--bg3)',
              borderRadius: 12,
              border: '1px solid var(--border)',
              display: 'grid',
              gap: 12,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>
              Edit Label: {editingLabel.name}
            </div>

            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Label name…"
              style={{ fontSize: 13 }}
              required
              autoFocus
            />

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setEditColor(c)}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    backgroundColor: c,
                    border: editColor === c ? '2px solid #fff' : '2px solid transparent',
                    cursor: 'pointer',
                    outline: 'none',
                    transform: editColor === c ? 'scale(1.15)' : 'scale(1)',
                    transition: '0.15s',
                  }}
                />
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setEditingLabel(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={isSavingEdit || !editName.trim()}
              >
                {isSavingEdit ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}

        {/* Labels List */}
        <div style={{ display: 'grid', gap: 8, maxHeight: 400, overflowY: 'auto', paddingRight: 2 }}>
          {filtered.map((lb) => (
            <div
              key={lb.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '9px 12px',
                background: 'var(--bg3)',
                borderRadius: 10,
                border: '1px solid var(--border)',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: `${lb.color}20`,
                    border: `1px solid ${lb.color}66`,
                    color: lb.color,
                    fontSize: 12,
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 16,
                    letterSpacing: '0.01em',
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: lb.color,
                      flexShrink: 0,
                    }}
                  />
                  {lb.name}
                </span>
              </div>

                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setEditingLabel(lb)
                      setEditName(lb.name || '')
                      setEditColor(lb.color)
                      setShowCreate(false)
                    }}
                    style={{ padding: '3px 8px', fontSize: 11.5, gap: 4 }}
                    title="Edit label"
                  >
                    <IconEdit size={12} /> Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleDelete(lb)}
                    style={{ padding: '3px 8px', fontSize: 11.5, color: '#f87171', gap: 4 }}
                    title="Delete label"
                  >
                    <IconTrash size={12} /> Delete
                  </button>
                </div>
              </div>
            )
          )}

          {filtered.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                color: 'var(--muted)',
                padding: '32px 16px',
                background: 'var(--bg3)',
                borderRadius: 10,
                border: '1px dashed var(--border)',
                fontSize: 12.5,
              }}
            >
              {search ? 'No matching labels found.' : 'No labels available yet. Create one above!'}
            </div>
          )}
        </div>
      </div>
    </Modal>

    {/* Delete Label Confirmation Dialog */}
    {labelToDelete && (
      <ConfirmDialog
        isOpen={!!labelToDelete}
        onClose={() => setLabelToDelete(null)}
        onConfirm={confirmDeleteLabel}
        title="Delete Label"
        message={`Are you sure you want to permanently delete "${labelToDelete.name}"? This label will be detached from all cards.`}
        confirmLabel="Delete Label"
        confirmVariant="danger"
      />
    )}
  </>
  )
}
