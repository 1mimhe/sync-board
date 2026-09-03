import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Document } from '../types'
import { documentApi } from '../api/endpoints'
import { useToast } from '../stores/toast.store'
import { IconDocument, IconPlus, IconSearch } from '../components/common/Icons'

export function DocumentsListPage() {
  const { wid } = useParams()
  const { addToast } = useToast()

  const [documents, setDocuments] = useState<Document[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)

  // Quick create
  const [newTitle, setNewTitle] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const loadDocuments = async (nextCursor?: string | null, searchQuery?: string) => {
    if (!wid) return
    setLoading(true)
    const res = await documentApi.list(wid, {
      cursor: nextCursor || undefined,
      search: searchQuery !== undefined ? searchQuery : search || undefined,
      limit: 20,
    })
    setLoading(false)

    if (res.success && res.data) {
      if (nextCursor) {
        setDocuments((prev) => [...prev, ...res.data!.items])
      } else {
        setDocuments(res.data.items)
      }
      setCursor(res.data.pagination.cursor || null)
      setHasMore(!!res.data.pagination.hasMore)
    }
  }

  useEffect(() => {
    loadDocuments(null)
  }, [wid])

  const handleCreateDoc = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!wid || !newTitle.trim()) return

    setIsCreating(true)
    const res = await documentApi.create(wid, { title: newTitle.trim() })
    setIsCreating(false)

    if (res.success && res.data) {
      setNewTitle('')
      addToast(`Document "${res.data.title}" created!`, 'success')
      loadDocuments(null)
    } else {
      addToast(res.error?.message || 'Failed to create document', 'error')
    }
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    loadDocuments(null, search)
  }

  return (
    <div style={{ display: 'grid', gap: 20, maxWidth: 1000, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.5px' }}>
            Collaborative Documents
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 13.5, marginTop: 4 }}>
            Multiplayer notes, technical specs, and live document editor.
          </p>
        </div>

        <form onSubmit={handleCreateDoc} style={{ display: 'flex', gap: 8 }}>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="New document title…"
            style={{ minWidth: 240, fontSize: 13 }}
            required
          />
          <button className="btn btn-primary" type="submit" disabled={isCreating}>
            <IconPlus size={16} /> Create Document
          </button>
        </form>
      </div>

      {/* Search Input */}
      <form onSubmit={handleSearchSubmit} style={{ position: 'relative' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Full-text search document titles and content…"
          style={{ width: '100%', paddingLeft: 36, fontSize: 13.5 }}
        />
        <IconSearch
          size={16}
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--muted)',
          }}
        />
      </form>

      {/* Documents List */}
      <div style={{ display: 'grid', gap: 10 }}>
        {documents.map((doc) => (
          <Link
            key={doc.id}
            to={`/workspaces/${wid}/documents/${doc.id}`}
            className="card shine"
            style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              textDecoration: 'none',
              borderRadius: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#fff',
                }}
              >
                <IconDocument size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#fff', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {doc.title}
                  {doc.parentCard && (
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
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted2)', marginTop: 2 }}>
                  status: {doc.status} • Updated {new Date(doc.updatedAt).toLocaleString()}
                </div>
              </div>
            </div>

            <span className="btn btn-ghost btn-sm">
              Open Editor →
            </span>
          </Link>
        ))}

        {documents.length === 0 && !loading && (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            No collaborative documents found. Create your first document above!
          </div>
        )}
      </div>

      {hasMore && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button className="btn btn-ghost" onClick={() => loadDocuments(cursor)} disabled={loading}>
            {loading ? 'Loading…' : 'Load More Documents'}
          </button>
        </div>
      )}
    </div>
  )
}
