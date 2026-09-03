import React, { useState } from 'react'
import type { CardAttachment } from '../../types'
import { attachmentApi } from '../../api/endpoints'
import { useToast } from '../../stores/toast.store'
import { IconPaperclip, IconLink, IconTrash } from '../common/Icons'

export interface AttachmentSectionProps {
  workspaceId: string
  boardId: string
  cardId: string
  attachments: CardAttachment[]
  onUpdated: () => void
}

export function AttachmentSection({
  workspaceId,
  boardId,
  cardId,
  attachments,
  onUpdated,
}: AttachmentSectionProps) {
  const { addToast } = useToast()
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState<'link' | 'image' | 'file'>('link')
  const [isAdding, setIsAdding] = useState(false)

  const handleAddAttachment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return

    const effectiveName = name.trim() || url.trim().replace(/^https?:\/\//, '').split('/')[0]

    setIsAdding(true)
    const res = await attachmentApi.create(workspaceId, boardId, cardId, {
      url: url.trim(),
      name: effectiveName,
      type,
    })
    setIsAdding(false)

    if (res.success) {
      setUrl('')
      setName('')
      addToast('Attachment added', 'success')
      onUpdated()
    } else {
      addToast(res.error?.message || 'Failed to add attachment', 'error')
    }
  }

  const handleDelete = async (attachmentId: string) => {
    const res = await attachmentApi.delete(workspaceId, boardId, cardId, attachmentId)
    if (res.success) {
      onUpdated()
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Add Attachment Form */}
      <form
        onSubmit={handleAddAttachment}
        style={{
          padding: 14,
          background: 'var(--bg3)',
          borderRadius: 12,
          border: '1px solid var(--border)',
          display: 'grid',
          gap: 10,
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconPaperclip size={16} /> Add Attachment or Web Link
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/spec.pdf"
            style={{ flex: 1, minWidth: 200, fontSize: 13 }}
            required
          />

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Display Name (optional)"
            style={{ width: 180, fontSize: 13 }}
          />

          <select
            value={type}
            onChange={(e) => setType(e.target.value as any)}
            style={{
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              padding: '6px 12px',
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: 700,
            }}
          >
            <option value="link">Link</option>
            <option value="image">Image</option>
            <option value="file">File</option>
          </select>

          <button className="btn btn-primary btn-sm" type="submit" disabled={isAdding}>
            {isAdding ? 'Attaching…' : 'Attach'}
          </button>
        </div>
      </form>

      {/* Attachments List */}
      <div style={{ display: 'grid', gap: 8 }}>
        {attachments.map((att) => {
          const isImage = att.type === 'image' || att.url.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i)

          return (
            <div
              key={att.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '10px 14px',
                background: 'var(--bg3)',
                borderRadius: 10,
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                {isImage ? (
                  <img
                    src={att.url}
                    alt={att.name}
                    style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover' }}
                    onError={(e) => {
                      ;(e.target as HTMLElement).style.display = 'none'
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 6,
                      background: 'rgba(255, 255, 255, 0.05)',
                      display: 'grid',
                      placeItems: 'center',
                      color: 'var(--muted)',
                    }}
                  >
                    <IconLink size={18} />
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <a
                    href={att.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      fontWeight: 700,
                      fontSize: 13,
                      color: '#fff',
                      textDecoration: 'underline',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      display: 'block',
                    }}
                  >
                    {att.name}
                  </a>
                  <span style={{ fontSize: 11, color: 'var(--muted2)' }}>
                    {att.type} • Attached {new Date(att.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <a
                  href={att.url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-ghost btn-sm"
                >
                  Open ↗
                </a>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ color: '#f87171', padding: 6 }}
                  onClick={() => handleDelete(att.id)}
                  title="Remove attachment"
                >
                  <IconTrash size={14} />
                </button>
              </div>
            </div>
          )
        })}

        {attachments.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--muted2)', fontSize: 13, padding: 12 }}>
            No attachments on this card yet.
          </div>
        )}
      </div>
    </div>
  )
}
