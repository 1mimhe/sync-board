import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Document } from '../../types'
import { documentApi } from '../../api/endpoints'
import { useToast } from '../../stores/toast.store'
import { IconDocument, IconPlus } from '../common/Icons'

export interface LinkedDocsSectionProps {
  workspaceId: string
  cardId: string
}

export function LinkedDocsSection({
  workspaceId,
  cardId,
}: LinkedDocsSectionProps) {
  const { addToast } = useToast()
  const [docs, setDocs] = useState<Document[]>([])
  const [newTitle, setNewTitle] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [loading, setLoading] = useState(false)

  const loadLinkedDocs = async () => {
    setLoading(true)
    const res = await documentApi.listByCard(workspaceId, cardId)
    setLoading(false)
    if (res.success && res.data) {
      setDocs(res.data)
    }
  }

  useEffect(() => {
    loadLinkedDocs()
  }, [workspaceId, cardId])

  const handleCreateDoc = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return

    setIsCreating(true)
    const res = await documentApi.create(workspaceId, {
      title: newTitle.trim(),
      parentCardId: cardId,
      cardId,
    })
    setIsCreating(false)

    if (res.success) {
      setNewTitle('')
      addToast('Collaborative doc created and linked', 'success')
      loadLinkedDocs()
    } else {
      addToast(res.error?.message || 'Failed to create document', 'error')
    }
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* Create New Document Form */}
      <form onSubmit={handleCreateDoc} style={{ display: 'flex', gap: 8 }}>
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="New document title (e.g. Design Specs, Meeting Notes)…"
          style={{ flex: 1, fontSize: 13 }}
        />
        <button
          className="btn btn-primary btn-sm"
          type="submit"
          disabled={isCreating || !newTitle.trim()}
        >
          <IconPlus size={14} /> Create Doc
        </button>
      </form>

      {/* Linked Documents List */}
      <div style={{ display: 'grid', gap: 8 }}>
        {docs.map((doc) => (
          <Link
            key={doc.id}
            to={`/workspaces/${workspaceId}/documents/${doc.id}`}
            className="card"
            style={{
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--bg3)',
              textDecoration: 'none',
              transition: '0.15s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#fff',
                }}
              >
                <IconDocument size={16} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>
                  {doc.title}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 2 }}>
                  Updated {new Date(doc.updatedAt).toLocaleDateString()}
                </div>
              </div>
            </div>

            <span className="btn btn-ghost btn-sm">
              Open Editor ↗
            </span>
          </Link>
        ))}

        {docs.length === 0 && !loading && (
          <div style={{ textAlign: 'center', color: 'var(--muted2)', fontSize: 13, padding: 12 }}>
            No collaborative documents linked to this card.
          </div>
        )}
      </div>
    </div>
  )
}
