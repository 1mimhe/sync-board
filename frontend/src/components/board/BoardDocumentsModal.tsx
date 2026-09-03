import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import type { BoardWithContent, Document } from '../../types'
import { documentApi } from '../../api/endpoints'
import { useToast } from '../../stores/toast.store'
import { Modal } from '../common/Modal'
import { IconDocument, IconPlus, IconSearch } from '../common/Icons'

export interface BoardDocumentsModalProps {
  isOpen: boolean
  onClose: () => void
  workspaceId: string
  board: BoardWithContent
}

export function BoardDocumentsModal({
  isOpen,
  onClose,
  workspaceId,
  board,
}: BoardDocumentsModalProps) {
  const { addToast } = useToast()
  const [docs, setDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  // Create doc attached to card
  const [newTitle, setNewTitle] = useState('')
  const [selectedCardId, setSelectedCardId] = useState<string>('')
  const [isCreating, setIsCreating] = useState(false)

  // Flatten all active cards from lists on this board
  const allCards = useMemo(() => {
    return (
      board.lists
        ?.filter((l) => !l.archivedAt)
        .flatMap((l) => l.cards?.filter((c) => !c.archivedAt) || []) || []
    )
  }, [board.lists])

  const loadBoardDocs = useCallback(async () => {
    setLoading(true)
    const [boardDocsRes, wsDocsRes] = await Promise.all([
      documentApi.listByBoard(workspaceId, board.id),
      documentApi.list(workspaceId, { limit: 100 }),
    ])
    setLoading(false)

    const boardDocs = boardDocsRes.success && boardDocsRes.data ? boardDocsRes.data : []
    const wsDocs = wsDocsRes.success && wsDocsRes.data ? wsDocsRes.data.items : []

    const existingIds = new Set(boardDocs.map((d) => d.id))
    const combined: Document[] = [...boardDocs]
    for (const d of wsDocs) {
      if (!existingIds.has(d.id) && !d.parentCardId) {
        combined.push(d)
      }
    }
    setDocs(combined)
  }, [workspaceId, board.id])

  useEffect(() => {
    if (isOpen) {
      loadBoardDocs()
      setSelectedCardId('')
    }
  }, [isOpen, loadBoardDocs])

  const handleCreateDoc = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return

    setIsCreating(true)
    const res = await documentApi.create(workspaceId, {
      title: newTitle.trim(),
      parentCardId: selectedCardId || undefined,
      cardId: selectedCardId || undefined,
    })
    setIsCreating(false)

    if (res.success) {
      setNewTitle('')
      addToast(
        selectedCardId
          ? 'Collaborative document created and linked to card!'
          : 'Collaborative document created!',
        'success'
      )
      loadBoardDocs()
    } else {
      addToast(res.error?.message || 'Failed to create document', 'error')
    }
  }

  const filteredDocs = docs.filter((d) => {
    const q = search.toLowerCase().trim()
    if (!q) return true
    const titleMatch = d.title.toLowerCase().includes(q)
    const cardMatch = d.parentCard?.title?.toLowerCase().includes(q)
    return titleMatch || cardMatch
  })

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Board Documents" maxWidth={680}>
      <div style={{ display: 'grid', gap: 16 }}>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
          View and create collaborative documents on <strong>{board.title}</strong> and workspace.
        </p>

        {/* Quick Create Doc Form */}
        <form
          onSubmit={handleCreateDoc}
          style={{
            padding: '12px 14px',
            borderRadius: 10,
            background: 'var(--bg3)',
            border: '1px solid var(--border)',
            display: 'grid',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
              Create collaborative document:
            </div>
            <span
              style={{
                fontSize: 11,
                color: 'var(--muted2)',
                background: 'rgba(255, 255, 255, 0.04)',
                padding: '2px 8px',
                borderRadius: 6,
                border: '1px solid var(--border)',
              }}
            >
              Card link is optional
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="New doc title (e.g. Spec, Notes)…"
              style={{ flex: 1, minWidth: 180, fontSize: 13 }}
              required
            />
            <select
              value={selectedCardId}
              onChange={(e) => setSelectedCardId(e.target.value)}
              style={{
                maxWidth: 230,
                fontSize: 12.5,
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg2)',
                color: 'var(--text)',
              }}
              title="Optionally link to a card on this board"
            >
              <option value="">No Card (General Document)</option>
              {allCards.map((c) => (
                <option key={c.id} value={c.id}>
                  Card: {c.title.length > 25 ? `${c.title.slice(0, 25)}…` : c.title}
                </option>
              ))}
            </select>
            <button
              className="btn btn-primary btn-sm"
              type="submit"
              disabled={isCreating || !newTitle.trim()}
            >
              <IconPlus size={14} /> Create Doc
            </button>
          </div>
        </form>

        {/* Search bar */}
        <div style={{ position: 'relative' }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents or card names…"
            style={{ width: '100%', paddingLeft: 34, fontSize: 13 }}
          />
          <IconSearch
            size={15}
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--muted)',
            }}
          />
        </div>

        {/* Documents List */}
        <div style={{ display: 'grid', gap: 8, maxHeight: 380, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>
              Loading documents…
            </div>
          ) : filteredDocs.length > 0 ? (
            filteredDocs.map((doc) => (
              <div
                key={doc.id}
                className="card shine"
                style={{
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  borderRadius: 10,
                  background: 'var(--bg3)',
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 8,
                      background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                      display: 'grid',
                      placeItems: 'center',
                      color: '#fff',
                      flexShrink: 0,
                    }}
                  >
                    <IconDocument size={18} />
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: 14,
                        color: 'var(--text)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {doc.title}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginTop: 3,
                        flexWrap: 'wrap',
                      }}
                    >
                      {doc.parentCard ? (
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
                      ) : (
                        <span
                          className="badge"
                          style={{
                            fontSize: 11,
                            background: 'rgba(6, 182, 212, 0.12)',
                            color: '#22d3ee',
                            border: '1px solid rgba(6, 182, 212, 0.25)',
                          }}
                        >
                          General Document
                        </span>
                      )}

                      <span style={{ fontSize: 11, color: 'var(--muted2)' }}>
                        Updated {new Date(doc.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <Link
                  to={`/workspaces/${workspaceId}/documents/${doc.id}`}
                  className="btn btn-ghost btn-sm"
                  onClick={onClose}
                  style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  Open Editor →
                </Link>
              </div>
            ))
          ) : (
            <div
              className="card"
              style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}
            >
              {search
                ? 'No documents match your search.'
                : 'No documents attached to cards on this board yet.'}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
