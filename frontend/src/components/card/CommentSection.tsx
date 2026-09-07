import React, { useState, useRef } from 'react'
import type { CardComment, WorkspaceMember } from '../../types'
import { commentApi } from '../../api/endpoints'
import { useAuth } from '../../stores/auth.store'
import { useToast } from '../../stores/toast.store'
import { Avatar } from '../common/Avatar'
import { MentionAutocomplete } from './MentionAutocomplete'
import {
  IconEdit,
  IconTrash,
  IconMessageSquare,
  IconChevronDown,
  IconChevronRight,
  IconCheck,
  IconX,
} from '../common/Icons'

export interface CommentSectionProps {
  workspaceId: string
  boardId: string
  cardId: string
  comments: CardComment[]
  members?: WorkspaceMember[]
  onUpdated: () => void
}

/**
 * Highlights @mention emails and @names inside comment body with styled chips.
 */
function renderCommentContent(content: string) {
  // Matches emails like @user@domain.com or names like @(Alex Rivera) or @Alex
  const regex = /(@[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|@[a-zA-Z0-9_]+(?:\s+[a-zA-Z0-9_]+)?)/g
  const parts = content.split(regex)

  return (
    <>
      {parts.map((part, i) => {
        if (part && part.startsWith('@') && part.length > 1) {
          return (
            <span
              key={i}
              style={{
                color: 'var(--violet2)',
                background: 'rgba(124, 58, 237, 0.15)',
                padding: '1px 6px',
                borderRadius: 4,
                fontWeight: 700,
                border: '1px solid rgba(124, 58, 237, 0.3)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              {part}
            </span>
          )
        }
        return part
      })}
    </>
  )
}

export function CommentSection({
  workspaceId,
  boardId,
  cardId,
  comments,
  members = [],
  onUpdated,
}: CommentSectionProps) {
  const { user } = useAuth()
  const { addToast } = useToast()

  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  // Thread reply states
  const [replyingToId, setReplyingToId] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [isSubmittingReply, setIsSubmittingReply] = useState(false)

  // Collapsed threads state (record of commentId -> boolean)
  const [collapsedThreads, setCollapsedThreads] = useState<Record<string, boolean>>({})

  // Mention autocomplete state
  const [mentionState, setMentionState] = useState<{
    target: 'main' | 'reply'
    query: string
    cursorIndex: number
  } | null>(null)

  const mainTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const replyTextareaRef = useRef<HTMLTextAreaElement | null>(null)

  const toggleThread = (commentId: string) => {
    setCollapsedThreads((prev) => ({
      ...prev,
      [commentId]: !prev[commentId],
    }))
  }

  // Detect mention trigger on textarea input
  const handleTextChange = (
    text: string,
    target: 'main' | 'reply',
    cursorPos: number,
  ) => {
    if (target === 'main') setContent(text)
    else setReplyContent(text)

    // Check if cursor is right after an '@' symbol
    const textBeforeCursor = text.slice(0, cursorPos)
    const match = textBeforeCursor.match(/@([a-zA-Z0-9_]*)$/)

    if (match && members.length > 0) {
      setMentionState({
        target,
        query: match[1],
        cursorIndex: cursorPos,
      })
    } else {
      setMentionState(null)
    }
  }

  const handleSelectMention = (member: WorkspaceMember) => {
    if (!mentionState) return
    const mentionName = member.user?.displayName || member.user?.email || 'user'
    const insertion = `@${mentionName} `

    if (mentionState.target === 'main') {
      const before = content.slice(0, mentionState.cursorIndex - 1 - mentionState.query.length)
      const after = content.slice(mentionState.cursorIndex)
      setContent(before + insertion + after)
      setTimeout(() => {
        if (mainTextareaRef.current) {
          mainTextareaRef.current.focus()
          const nextCursor = before.length + insertion.length
          mainTextareaRef.current.setSelectionRange(nextCursor, nextCursor)
        }
      }, 0)
    } else {
      const before = replyContent.slice(0, mentionState.cursorIndex - 1 - mentionState.query.length)
      const after = replyContent.slice(mentionState.cursorIndex)
      setReplyContent(before + insertion + after)
      setTimeout(() => {
        if (replyTextareaRef.current) {
          replyTextareaRef.current.focus()
          const nextCursor = before.length + insertion.length
          replyTextareaRef.current.setSelectionRange(nextCursor, nextCursor)
        }
      }, 0)
    }

    setMentionState(null)
  }

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = content.trim()
    if (!trimmed) return

    setIsSubmitting(true)
    const res = await commentApi.create(workspaceId, boardId, cardId, {
      content: trimmed,
    })
    setIsSubmitting(false)

    if (res.success) {
      setContent('')
      setMentionState(null)
      addToast('Comment posted', 'success')
      onUpdated()
    } else {
      addToast(res.error?.message || 'Failed to post comment', 'error')
    }
  }

  const handlePostReply = async (parentCommentId: string) => {
    const trimmed = replyContent.trim()
    if (!trimmed) return

    setIsSubmittingReply(true)
    const res = await commentApi.create(workspaceId, boardId, cardId, {
      content: trimmed,
      parentCommentId,
    })
    setIsSubmittingReply(false)

    if (res.success) {
      setReplyContent('')
      setReplyingToId(null)
      setMentionState(null)
      // Ensure thread is uncollapsed when a reply is posted
      setCollapsedThreads((prev) => ({ ...prev, [parentCommentId]: false }))
      addToast('Reply sent', 'success')
      onUpdated()
    } else {
      addToast(res.error?.message || 'Failed to send reply', 'error')
    }
  }

  const handleSaveEdit = async (commentId: string) => {
    const trimmed = editContent.trim()
    if (!trimmed) return
    const res = await commentApi.update(workspaceId, boardId, cardId, commentId, {
      content: trimmed,
    })
    if (res.success) {
      setEditingId(null)
      addToast('Comment updated', 'success')
      onUpdated()
    } else {
      addToast(res.error?.message || 'Failed to update comment', 'error')
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    const res = await commentApi.delete(workspaceId, boardId, cardId, commentId)
    if (res.success) {
      addToast('Comment deleted', 'info')
      onUpdated()
    } else {
      addToast(res.error?.message || 'Failed to delete comment', 'error')
    }
  }

  // Normalize comments list
  const rawList: CardComment[] = Array.isArray(comments)
    ? comments
    : typeof comments === 'object' && comments !== null && 'items' in comments && Array.isArray((comments as { items: CardComment[] }).items)
    ? (comments as { items: CardComment[] }).items
    : []

  const topLevel = rawList.filter((c) => !c.parentCommentId)
  const getReplies = (parentId: string) => rawList.filter((c) => c.parentCommentId === parentId)

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Post Comment Box */}
      <form onSubmit={handlePostComment} style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Avatar
            name={user?.displayName}
            email={user?.email}
            avatarUrl={user?.avatarUrl}
            size={34}
          />
          <div style={{ flex: 1, display: 'grid', gap: 8, position: 'relative' }}>
            <textarea
              ref={mainTextareaRef}
              value={content}
              onChange={(e) =>
                handleTextChange(e.target.value, 'main', e.target.selectionStart || 0)
              }
              placeholder="Write a comment… Type @ to mention a workspace member"
              rows={3}
              style={{ width: '100%', fontSize: 13, resize: 'vertical' }}
            />

            {/* Mention Autocomplete Dropdown for Main Input */}
            {mentionState && mentionState.target === 'main' && (
              <MentionAutocomplete
                members={members}
                query={mentionState.query}
                onSelect={handleSelectMention}
                onClose={() => setMentionState(null)}
              />
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: 'var(--muted2)' }}>
                Tip: Type <strong>@name</strong> to mention a team member
              </span>
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

      {/* Comments List with Thread Trees */}
      <div style={{ display: 'grid', gap: 14 }}>
        {topLevel.length === 0 ? (
          <div
            style={{
              fontSize: 12.5,
              color: 'var(--muted2)',
              textAlign: 'center',
              padding: 18,
              background: 'var(--bg3)',
              borderRadius: 'var(--radius2)',
              border: '1px dashed var(--border)',
            }}
          >
            No comments yet. Start the conversation!
          </div>
        ) : (
          topLevel.map((comment) => {
            const isAuthor = comment.authorId === user?.id
            const isEditing = editingId === comment.id
            const replies = getReplies(comment.id)
            const isReplying = replyingToId === comment.id
            const isCollapsed = collapsedThreads[comment.id] || false

            return (
              <div key={comment.id} style={{ display: 'grid', gap: 8 }}>
                {/* Parent Comment Card */}
                <div
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>
                          {comment.author?.displayName || 'Unknown Author'}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--muted2)' }}>
                          {new Date(comment.createdAt).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '2px 8px', fontSize: 11, gap: 4 }}
                          onClick={() => {
                            setReplyingToId(isReplying ? null : comment.id)
                            setReplyContent('')
                            setMentionState(null)
                          }}
                        >
                          <IconMessageSquare size={11} /> Reply
                        </button>
                        {isAuthor && (
                          <>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '2px 6px', fontSize: 11 }}
                              onClick={() => {
                                setEditingId(comment.id)
                                setEditContent(comment.content)
                              }}
                              title="Edit comment"
                            >
                              <IconEdit size={12} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '2px 6px', fontSize: 11, color: '#f87171' }}
                              onClick={() => handleDeleteComment(comment.id)}
                              title="Delete comment"
                            >
                              <IconTrash size={12} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {isEditing ? (
                      <div style={{ display: 'grid', gap: 8 }}>
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          rows={2}
                          style={{ width: '100%', fontSize: 13 }}
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
                        {renderCommentContent(comment.content)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Thread Collapse / Expand Header */}
                {replies.length > 0 && (
                  <div style={{ paddingLeft: 20 }}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => toggleThread(comment.id)}
                      style={{
                        padding: '2px 6px',
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--violet2)',
                        gap: 4,
                      }}
                    >
                      {isCollapsed ? (
                        <>
                          <IconChevronRight size={13} /> Show {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                        </>
                      ) : (
                        <>
                          <IconChevronDown size={13} /> Hide {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Thread Replies with Connected Tree Line */}
                {!isCollapsed && replies.length > 0 && (
                  <div
                    style={{
                      marginLeft: 20,
                      paddingLeft: 16,
                      borderLeft: '2px solid rgba(124, 58, 237, 0.3)',
                      display: 'grid',
                      gap: 8,
                      position: 'relative',
                    }}
                  >
                    {replies.map((reply) => {
                      const isReplyAuthor = reply.authorId === user?.id
                      const isEditingReply = editingId === reply.id

                      return (
                        <div
                          key={reply.id}
                          style={{
                            display: 'flex',
                            gap: 10,
                            padding: 10,
                            background: 'var(--bg2)',
                            borderRadius: 10,
                            border: '1px solid var(--border)',
                            position: 'relative',
                          }}
                        >
                          <Avatar
                            name={reply.author?.displayName}
                            email={reply.author?.email}
                            avatarUrl={reply.author?.avatarUrl}
                            size={26}
                          />
                          <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--text)' }}>
                                  {reply.author?.displayName || 'User'}
                                </span>
                                <span style={{ fontSize: 10.5, color: 'var(--muted2)' }}>
                                  {new Date(reply.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>

                              {isReplyAuthor && (
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    style={{ padding: '2px 4px', fontSize: 10 }}
                                    onClick={() => {
                                      setEditingId(reply.id)
                                      setEditContent(reply.content)
                                    }}
                                  >
                                    <IconEdit size={11} />
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    style={{ padding: '2px 4px', fontSize: 10, color: '#f87171' }}
                                    onClick={() => handleDeleteComment(reply.id)}
                                  >
                                    <IconTrash size={11} />
                                  </button>
                                </div>
                              )}
                            </div>

                            {isEditingReply ? (
                              <div style={{ display: 'grid', gap: 6 }}>
                                <textarea
                                  value={editContent}
                                  onChange={(e) => setEditContent(e.target.value)}
                                  rows={2}
                                  style={{ width: '100%', fontSize: 12 }}
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
                                    onClick={() => handleSaveEdit(reply.id)}
                                  >
                                    Save
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ fontSize: 12.5, color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                                {renderCommentContent(reply.content)}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Reply Input Box */}
                {isReplying && (
                  <div
                    style={{
                      marginLeft: 20,
                      paddingLeft: 16,
                      borderLeft: '2px dashed rgba(124, 58, 237, 0.3)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        gap: 10,
                        padding: 10,
                        background: 'var(--bg2)',
                        borderRadius: 10,
                        border: '1px solid var(--border)',
                        position: 'relative',
                      }}
                    >
                      <Avatar
                        name={user?.displayName}
                        email={user?.email}
                        avatarUrl={user?.avatarUrl}
                        size={26}
                      />
                      <div style={{ flex: 1, display: 'grid', gap: 6, position: 'relative' }}>
                        <textarea
                          ref={replyTextareaRef}
                          autoFocus
                          value={replyContent}
                          onChange={(e) =>
                            handleTextChange(e.target.value, 'reply', e.target.selectionStart || 0)
                          }
                          placeholder={`Reply to ${comment.author?.displayName || 'comment'}… Type @ to mention`}
                          rows={2}
                          style={{ width: '100%', fontSize: 12 }}
                        />

                        {/* Mention Autocomplete Dropdown for Reply */}
                        {mentionState && mentionState.target === 'reply' && (
                          <MentionAutocomplete
                            members={members}
                            query={mentionState.query}
                            onSelect={handleSelectMention}
                            onClose={() => setMentionState(null)}
                          />
                        )}

                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: 11 }}
                            onClick={() => {
                              setReplyingToId(null)
                              setReplyContent('')
                              setMentionState(null)
                            }}
                          >
                            <IconX size={12} /> Cancel
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            style={{ fontSize: 11, gap: 4 }}
                            disabled={isSubmittingReply || !replyContent.trim()}
                            onClick={() => handlePostReply(comment.id)}
                          >
                            <IconCheck size={12} /> {isSubmittingReply ? 'Replying…' : 'Send Reply'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
