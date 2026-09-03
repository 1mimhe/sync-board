import { useState } from 'react'
import type { CardComment } from '../../types'
import { commentApi } from '../../api/endpoints'
import { useAuth } from '../../stores/auth.store'
import { Avatar } from '../common/Avatar'
import { IconEdit, IconTrash } from '../common/Icons'

export interface CommentSectionProps {
  workspaceId: string
  boardId: string
  cardId: string
  comments: CardComment[]
  onUpdated: () => void
}

export function CommentSection({
  workspaceId,
  boardId,
  cardId,
  comments,
  onUpdated,
}: CommentSectionProps) {
  const { user } = useAuth()
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return

    setIsSubmitting(true)
    const res = await commentApi.create(workspaceId, boardId, cardId, {
      content: content.trim(),
    })
    setIsSubmitting(false)

    if (res.success) {
      setContent('')
      onUpdated()
    }
  }

  const handleSaveEdit = async (commentId: string) => {
    if (!editContent.trim()) return
    const res = await commentApi.update(workspaceId, boardId, cardId, commentId, {
      content: editContent.trim(),
    })
    if (res.success) {
      setEditingId(null)
      onUpdated()
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    const res = await commentApi.delete(workspaceId, boardId, cardId, commentId)
    if (res.success) {
      onUpdated()
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Post Comment Form */}
      <form onSubmit={handlePostComment} style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <Avatar
            name={user?.displayName}
            email={user?.email}
            avatarUrl={user?.avatarUrl}
            size={34}
          />
          <div style={{ flex: 1, display: 'grid', gap: 8 }}>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write a comment or update…"
              rows={3}
              style={{ width: '100%', fontSize: 13, resize: 'vertical' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-primary btn-sm"
                type="submit"
                disabled={isSubmitting || !content.trim()}
              >
                {isSubmitting ? 'Posting…' : 'Post Comment'}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Comments Timeline */}
      <div style={{ display: 'grid', gap: 12 }}>
        {(Array.isArray(comments) ? comments : ((comments as any)?.items || [])).map((comment: CardComment) => {
          const isAuthor = comment.authorId === user?.id
          const isEditing = editingId === comment.id

          return (
            <div
              key={comment.id}
              style={{
                display: 'flex',
                gap: 12,
                padding: 12,
                background: 'var(--bg3)',
                borderRadius: 12,
                border: '1px solid var(--border)',
              }}
            >
              <Avatar
                name={comment.author?.displayName}
                email={comment.author?.email}
                avatarUrl={comment.author?.avatarUrl}
                size={32}
              />
              <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>
                      {comment.author?.displayName || 'Unknown Author'}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--muted2)', marginLeft: 8 }}>
                      {new Date(comment.createdAt).toLocaleString()}
                    </span>
                  </div>

                  {isAuthor && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '2px 6px', fontSize: 11 }}
                        onClick={() => {
                          setEditingId(comment.id)
                          setEditContent(comment.content)
                        }}
                      >
                        <IconEdit size={12} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '2px 6px', fontSize: 11, color: '#f87171' }}
                        onClick={() => handleDeleteComment(comment.id)}
                      >
                        <IconTrash size={12} />
                      </button>
                    </div>
                  )}
                </div>

                {isEditing ? (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={2}
                      style={{ fontSize: 13 }}
                    />
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => handleSaveEdit(comment.id)}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                    {comment.content}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {comments.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--muted2)', fontSize: 13, padding: 12 }}>
            No comments yet. Be the first to leave one.
          </div>
        )}
      </div>
    </div>
  )
}
