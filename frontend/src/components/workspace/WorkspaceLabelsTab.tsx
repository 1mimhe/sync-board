import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { BoardLabel, CardWithDetails, WorkspaceWithRole } from '../../types'
import { labelApi } from '../../api/endpoints'
import { useToast } from '../../stores/toast.store'
import { Modal } from '../common/Modal'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { IconTag, IconPlus, IconSearch, IconEdit, IconTrash, IconBoard, IconClose } from '../common/Icons'

export interface WorkspaceLabelsTabProps {
  workspace: WorkspaceWithRole
  onLabelsCountChange?: (count: number) => void
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

export function WorkspaceLabelsTab({ workspace, onLabelsCountChange }: WorkspaceLabelsTabProps) {
  const { addToast } = useToast()
  const [labels, setLabels] = useState<BoardLabel[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Tagged cards viewer modal
  const [viewingCardsLabel, setViewingCardsLabel] = useState<BoardLabel | null>(null)
  const [taggedCards, setTaggedCards] = useState<CardWithDetails[]>([])
  const [loadingCards, setLoadingCards] = useState(false)

  // Creation State
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

  const loadLabels = async () => {
    setLoading(true)
    const res = await labelApi.listForWorkspace(workspace.id)
    if (res.success && res.data) {
      setLabels(res.data)
      onLabelsCountChange?.(res.data.length)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadLabels()
  }, [workspace.id])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setIsCreating(true)
    const res = await labelApi.createWorkspaceLabel(workspace.id, {
      name: name.trim(),
      color,
    })
    setIsCreating(false)

    if (res.success) {
      setName('')
      setShowCreate(false)
      addToast('Workspace label created', 'success')
      loadLabels()
    } else {
      addToast(res.error?.message || 'Failed to create workspace label', 'error')
    }
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingLabel || !editName.trim()) return

    setIsSavingEdit(true)
    const res = await labelApi.updateLabel(workspace.id, null, editingLabel.id, {
      name: editName.trim(),
      color: editColor,
    })
    setIsSavingEdit(false)

    if (res.success) {
      setEditingLabel(null)
      addToast('Label updated', 'success')
      loadLabels()
    } else {
      addToast(res.error?.message || 'Failed to update label', 'error')
    }
  }

  const handleDelete = (label: BoardLabel) => {
    setLabelToDelete(label)
  }

  const confirmDeleteLabel = async () => {
    if (!labelToDelete) return
    const res = await labelApi.deleteLabel(workspace.id, null, labelToDelete.id)
    if (res.success) {
      addToast('Label deleted', 'info')
      if (editingLabel?.id === labelToDelete.id) setEditingLabel(null)
      loadLabels()
    } else {
      addToast(res.error?.message || 'Failed to delete label', 'error')
    }
    setLabelToDelete(null)
  }

  const handleOpenCards = async (label: BoardLabel) => {
    setViewingCardsLabel(label)
    setLoadingCards(true)
    const res = await labelApi.getCardsForLabel(workspace.id, label.id)
    if (res.success && res.data) {
      setTaggedCards(res.data)
    } else {
      setTaggedCards([])
    }
    setLoadingCards(false)
  }

  const filtered = labels.filter((lb) =>
    (lb.name || '').toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Header Description & Controls */}
      <div
        className="card"
        style={{
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          background: 'linear-gradient(180deg, rgba(28, 28, 33, 0.85) 0%, rgba(18, 18, 22, 0.95) 100%)',
          borderRadius: 14,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.25), rgba(79, 70, 229, 0.25))',
              border: '1px solid rgba(124, 58, 237, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#c4b5fd',
              boxShadow: '0 0 10px rgba(124, 58, 237, 0.2)',
              flexShrink: 0,
            }}
          >
            <IconTag size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#fff', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
              Labels
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2, lineHeight: 1.3 }}>
              All labels in <strong style={{ color: 'var(--fg)', fontWeight: 600 }}>{workspace.name}</strong>.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: 230 }}>
            <span
              style={{
                position: 'absolute',
                left: 11,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--muted)',
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <IconSearch size={14} />
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search labels…"
              style={{
                width: '100%',
                height: 36,
                paddingLeft: 34,
                paddingRight: search ? 30 : 12,
                fontSize: 13,
                background: 'rgba(0, 0, 0, 0.35)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 8,
                color: '#fff',
                outline: 'none',
                transition: 'all 0.18s ease',
                boxSizing: 'border-box',
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--muted)',
                  cursor: 'pointer',
                  padding: 2,
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Clear search"
              >
                <IconClose size={13} />
              </button>
            )}
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setShowCreate(!showCreate)
              setEditingLabel(null)
            }}
            style={{
              height: 36,
              padding: '0 14px',
              fontSize: 13,
              fontWeight: 700,
              borderRadius: 8,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 2px 10px rgba(124, 58, 237, 0.35)',
            }}
          >
            <IconPlus size={15} /> {showCreate ? 'Cancel' : 'New Label'}
          </button>
        </div>
      </div>

      {/* Create Label Subform */}
      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="card"
          style={{
            padding: 18,
            display: 'grid',
            gap: 12,
            background: 'var(--bg2)',
            borderRadius: 14,
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>
            Create New Label
          </div>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Label name (e.g. Frontend, DevOps, Urgent, Design System)…"
            style={{ fontSize: 13, height: 38, borderRadius: 8 }}
            required
            autoFocus
          />

          {/* Live Preview */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '2px 0' }}>
            <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Preview:</span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: `${color}1c`,
                border: `1px solid ${color}60`,
                color: color,
                fontSize: 12.5,
                fontWeight: 700,
                padding: '3px 12px',
                borderRadius: 16,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: color,
                  boxShadow: `0 0 6px ${color}`,
                }}
              />
              {name.trim() || 'Label Preview'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
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
                  border: color === c ? '2.5px solid #fff' : '2px solid transparent',
                  cursor: 'pointer',
                  outline: 'none',
                  transform: color === c ? 'scale(1.2)' : 'scale(1)',
                  transition: 'all 0.15s ease',
                  boxShadow: color === c ? `0 0 10px ${c}` : 'none',
                }}
              />
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
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

      {/* Edit Label Subform */}
      {editingLabel && (
        <form
          onSubmit={handleSaveEdit}
          className="card"
          style={{
            padding: 18,
            display: 'grid',
            gap: 12,
            background: 'var(--bg2)',
            borderRadius: 14,
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>
            Edit Label: {editingLabel.name}
          </div>

          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Label name…"
            style={{ fontSize: 13, height: 38, borderRadius: 8 }}
            required
            autoFocus
          />

          {/* Live Preview */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '2px 0' }}>
            <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Preview:</span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: `${editColor}1c`,
                border: `1px solid ${editColor}60`,
                color: editColor,
                fontSize: 12.5,
                fontWeight: 700,
                padding: '3px 12px',
                borderRadius: 16,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: editColor,
                  boxShadow: `0 0 6px ${editColor}`,
                }}
              />
              {editName.trim() || 'Label Preview'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
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
                  border: editColor === c ? '2.5px solid #fff' : '2px solid transparent',
                  cursor: 'pointer',
                  outline: 'none',
                  transform: editColor === c ? 'scale(1.2)' : 'scale(1)',
                  transition: 'all 0.15s ease',
                  boxShadow: editColor === c ? `0 0 10px ${c}` : 'none',
                }}
              />
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
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

      {/* Labels Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
          gap: 10,
        }}
      >
        {filtered.map((lb) => (
          <div
            key={lb.id}
            className="card"
            style={{
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              background: 'rgba(22, 22, 26, 0.75)',
              borderRadius: 12,
              border: '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
              transition: 'all 0.18s ease',
              overflow: 'hidden',
            }}
          >
            {/* Label Pill */}
            <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, flex: 1 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  background: `${lb.color}1c`,
                  border: `1px solid ${lb.color}55`,
                  color: lb.color,
                  fontSize: 12.5,
                  fontWeight: 700,
                  padding: '4px 11px',
                  borderRadius: 16,
                  letterSpacing: '0.01em',
                  maxWidth: '100%',
                  overflow: 'hidden',
                }}
                title={lb.name || undefined}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: lb.color,
                    boxShadow: `0 0 6px ${lb.color}`,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {lb.name}
                </span>
              </span>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => handleOpenCards(lb)}
                style={{
                  height: 28,
                  padding: '0 8px',
                  fontSize: 11.5,
                  fontWeight: 600,
                  borderRadius: 6,
                  color: '#c4b5fd',
                  background: 'rgba(124, 58, 237, 0.12)',
                  border: '1px solid rgba(124, 58, 237, 0.25)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title="View cards tagged with this label"
              >
                <IconBoard size={12} /> Cards
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingLabel(lb)
                  setEditName(lb.name || '')
                  setEditColor(lb.color)
                  setShowCreate(false)
                }}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: 'var(--muted)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  padding: 0,
                }}
                title="Edit label"
              >
                <IconEdit size={13} />
              </button>

              <button
                type="button"
                onClick={() => handleDelete(lb)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  background: 'rgba(239, 68, 68, 0.07)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  color: '#f87171',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  padding: 0,
                }}
                title="Delete label"
              >
                <IconTrash size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {!loading && filtered.length === 0 && (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
          {search ? 'No labels found matching your search.' : 'No labels created yet. Create one above!'}
        </div>
      )}

      {/* View Tagged Cards Modal */}
      {viewingCardsLabel && (
        <Modal
          isOpen={!!viewingCardsLabel}
          onClose={() => setViewingCardsLabel(null)}
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  backgroundColor: viewingCardsLabel.color,
                  display: 'inline-block',
                }}
              />
              Cards tagged with "{viewingCardsLabel.name}" ({taggedCards.length})
            </div>
          }
          maxWidth={600}
        >
          <div style={{ display: 'grid', gap: 10, maxHeight: 420, overflowY: 'auto' }}>
            {loadingCards && (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>
                Loading tagged cards…
              </div>
            )}

            {!loadingCards && taggedCards.length === 0 && (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>
                No active cards found with this label across any boards.
              </div>
            )}

            {!loadingCards &&
              taggedCards.map((c: CardWithDetails) => (
                <div
                  key={c.id}
                  style={{
                    padding: '12px 16px',
                    background: 'var(--bg3)',
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#fff' }}>
                      {c.title}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted2)', marginTop: 2 }}>
                      Board: <strong style={{ color: 'var(--fg)' }}>{c.list?.board?.title || 'Board'}</strong> • List: {c.list?.title || 'List'}
                    </div>
                  </div>

                  {c.list?.boardId && (
                    <Link
                      to={`/workspaces/${workspace.id}/boards/${c.list.boardId}`}
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--violet2)' }}
                      onClick={() => setViewingCardsLabel(null)}
                    >
                      Open Board →
                    </Link>
                  )}
                </div>
              ))}
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Dialog */}
      {labelToDelete && (
        <ConfirmDialog
          isOpen={!!labelToDelete}
          onClose={() => setLabelToDelete(null)}
          onConfirm={confirmDeleteLabel}
          title="Delete Workspace Label"
          message={`Are you sure you want to permanently delete "${labelToDelete.name}"? This label will be detached from all cards across the workspace.`}
          confirmLabel="Delete Label"
          confirmVariant="danger"
        />
      )}
    </div>
  )
}
