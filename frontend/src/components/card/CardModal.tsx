import { useEffect, useState, useCallback } from 'react'
import type {
  Card,
  CardWithDetails,
  BoardLabel,
  WorkspaceMember,
  Checklist,
  CardComment,
  CardAttachment,
} from '../../types'
import {
  cardApi,
  labelApi,
  checklistApi,
  commentApi,
  attachmentApi,
} from '../../api/endpoints'
import { useToast } from '../../stores/toast.store'
import { Modal } from '../common/Modal'
import { LabelPicker } from './LabelPicker'
import { AssigneePicker } from './AssigneePicker'
import { ChecklistSection } from './ChecklistSection'
import { CommentSection } from './CommentSection'
import { AttachmentSection } from './AttachmentSection'
import { LinkedDocsSection } from './LinkedDocsSection'
import {
  IconCheckSquare,
  IconMessageSquare,
  IconPaperclip,
  IconDocument,
  IconCalendar,
  IconArchive,
  IconCamera,
} from '../common/Icons'

export interface CardModalProps {
  card: Card
  workspaceId: string
  boardId: string
  members: WorkspaceMember[]
  isOpen: boolean
  onClose: () => void
  onCardUpdated: () => void
}

type TabType = 'overview' | 'checklists' | 'comments' | 'attachments' | 'docs'

export function CardModal({
  card,
  workspaceId,
  boardId,
  members,
  isOpen,
  onClose,
  onCardUpdated,
}: CardModalProps) {
  const { addToast } = useToast()
  const [detail, setDetail] = useState<CardWithDetails | null>(null)
  const [boardLabels, setBoardLabels] = useState<BoardLabel[]>([])
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [comments, setComments] = useState<CardComment[]>([])
  const [attachments, setAttachments] = useState<CardAttachment[]>([])
  const [tab, setTab] = useState<TabType>('overview')

  // Form states
  const [title, setTitle] = useState(card.title)
  const [description, setDescription] = useState(card.description || '')
  const [dueDate, setDueDate] = useState(card.dueDate ? card.dueDate.slice(0, 10) : '')
  const [isCompleted, setIsCompleted] = useState(card.isCompleted || false)
  const [coverUrl, setCoverUrl] = useState(card.coverUrl || '')

  const loadCardDetails = useCallback(async () => {
    try {
      const [cardRes, labelsRes, checklistsRes, commentsRes, attachmentsRes] = await Promise.all([
        cardApi.getDetails(workspaceId, boardId, card.id),
        labelApi.listForBoard(workspaceId, boardId),
        checklistApi.list(workspaceId, boardId, card.id),
        commentApi.list(workspaceId, boardId, card.id),
        attachmentApi.list(workspaceId, boardId, card.id),
      ])

      if (cardRes.success && cardRes.data) {
        setDetail(cardRes.data)
        setTitle(cardRes.data.title)
        setDescription(cardRes.data.description || '')
        setDueDate(cardRes.data.dueDate ? cardRes.data.dueDate.slice(0, 10) : '')
        setIsCompleted(!!cardRes.data.isCompleted)
        setCoverUrl(cardRes.data.coverUrl || '')
      }

      if (labelsRes.success && labelsRes.data) {
        setBoardLabels(labelsRes.data)
      }

      if (checklistsRes.success && checklistsRes.data) {
        setChecklists(checklistsRes.data)
      }

      if (commentsRes.success && commentsRes.data) {
        const raw = commentsRes.data
        const items = Array.isArray(raw)
          ? raw
          : raw && typeof raw === 'object' && 'items' in raw && Array.isArray((raw as { items: CardComment[] }).items)
          ? (raw as { items: CardComment[] }).items
          : []
        setComments(items)
      }

      if (attachmentsRes.success && attachmentsRes.data) {
        setAttachments(attachmentsRes.data)
      }
    } catch (err) {
      console.error('Failed to load full card details', err)
    }
  }, [workspaceId, boardId, card.id])

  useEffect(() => {
    if (isOpen) {
      loadCardDetails()
    }
  }, [isOpen, loadCardDetails])

  const handleTitleBlur = async () => {
    const trimmed = title.trim()
    if (!trimmed || trimmed === detail?.title) return
    await cardApi.update(workspaceId, boardId, card.id, { title: trimmed })
    onCardUpdated()
  }

  const handleDescriptionBlur = async () => {
    if (description === detail?.description) return
    await cardApi.update(workspaceId, boardId, card.id, {
      description: description.trim() || null,
    })
    onCardUpdated()
  }

  const handleDueDateChange = async (newDate: string) => {
    setDueDate(newDate)
    await cardApi.update(workspaceId, boardId, card.id, {
      dueDate: newDate ? new Date(newDate).toISOString() : null,
    })
    onCardUpdated()
  }

  const handleToggleCompletion = async () => {
    const next = !isCompleted
    setIsCompleted(next)
    await cardApi.update(workspaceId, boardId, card.id, { isCompleted: next })
    onCardUpdated()
  }

  const handleCoverUrlBlur = async () => {
    if (coverUrl === detail?.coverUrl) return
    await cardApi.update(workspaceId, boardId, card.id, {
      coverUrl: coverUrl.trim() || null,
    })
    onCardUpdated()
  }

  const handleArchiveCard = async () => {
    const res = await cardApi.archive(workspaceId, boardId, card.id)
    if (res.success) {
      addToast('Card archived', 'info')
      onClose()
      onCardUpdated()
    }
  }

  const current = detail || card
  const isOverdue = dueDate && new Date(dueDate) < new Date() && !isCompleted

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth={820}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minWidth: 0 }}>
          <input
            type="checkbox"
            checked={isCompleted}
            onChange={handleToggleCompletion}
            style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--emerald)' }}
            title={isCompleted ? 'Mark incomplete' : 'Mark complete'}
          />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            style={{
              background: 'transparent',
              border: 'none',
              fontWeight: 800,
              fontSize: 18,
              color: 'var(--text)',
              width: '100%',
              textDecoration: isCompleted ? 'line-through' : 'none',
              opacity: isCompleted ? 0.7 : 1,
            }}
          />
        </div>
      }
      headerExtra={
        <button
          className="btn btn-ghost btn-sm"
          style={{ color: '#f87171' }}
          onClick={handleArchiveCard}
          title="Archive card"
        >
          <IconArchive size={15} /> Archive
        </button>
      }
    >
      <div style={{ display: 'grid', gap: 18 }}>
        {/* Cover Image */}
        {coverUrl && (
          <div
            style={{
              height: 140,
              borderRadius: 12,
              overflow: 'hidden',
              backgroundImage: `url(${coverUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            }}
          />
        )}

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            borderBottom: '1px solid var(--border)',
            paddingBottom: 10,
            flexWrap: 'wrap',
          }}
        >
          <button
            className={`btn btn-sm ${tab === 'overview' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTab('overview')}
          >
            Overview
          </button>
          <button
            className={`btn btn-sm ${tab === 'checklists' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTab('checklists')}
          >
            <IconCheckSquare size={14} /> Checklists ({checklists.length})
          </button>
          <button
            className={`btn btn-sm ${tab === 'comments' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTab('comments')}
          >
            <IconMessageSquare size={14} /> Comments ({comments.length})
          </button>
          <button
            className={`btn btn-sm ${tab === 'attachments' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTab('attachments')}
          >
            <IconPaperclip size={14} /> Attachments ({attachments.length})
          </button>
          <button
            className={`btn btn-sm ${tab === 'docs' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTab('docs')}
          >
            <IconDocument size={14} /> Linked Docs
          </button>
        </div>

        {/* Tab Content */}
        {tab === 'overview' && (
          <div style={{ display: 'grid', gap: 18 }}>
            {/* Description */}
            <div style={{ display: 'grid', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={handleDescriptionBlur}
                placeholder="Add more details, specs, or acceptance criteria…"
                rows={4}
                style={{ fontSize: 13, resize: 'vertical' }}
              />
            </div>

            {/* Labels and Assignees Two-Column Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              <div
                style={{
                  padding: 14,
                  background: 'var(--bg3)',
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                }}
              >
                <LabelPicker
                  workspaceId={workspaceId}
                  boardId={boardId}
                  cardId={card.id}
                  cardLabels={current.labels || []}
                  boardLabels={boardLabels}
                  onUpdated={() => {
                    loadCardDetails()
                    onCardUpdated()
                  }}
                />
              </div>

              <div
                style={{
                  padding: 14,
                  background: 'var(--bg3)',
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                }}
              >
                <AssigneePicker
                  workspaceId={workspaceId}
                  boardId={boardId}
                  cardId={card.id}
                  assignees={current.assignees || []}
                  members={members}
                  onUpdated={() => {
                    loadCardDetails()
                    onCardUpdated()
                  }}
                />
              </div>
            </div>

            {/* Dates & Cover Image */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              <div
                style={{
                  padding: 14,
                  background: 'var(--bg3)',
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  display: 'grid',
                  gap: 8,
                }}
              >
                <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IconCalendar size={15} /> Due Date
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => handleDueDateChange(e.target.value)}
                    style={{ flex: 1, fontSize: 13 }}
                  />
                  {dueDate && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleDueDateChange('')}
                    >
                      Clear
                    </button>
                  )}
                </div>
                {isOverdue && (
                  <span style={{ fontSize: 11, color: '#f87171', fontWeight: 700 }}>
                    This task is overdue
                  </span>
                )}
              </div>

              <div
                style={{
                  padding: 14,
                  background: 'var(--bg3)',
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  display: 'grid',
                  gap: 8,
                }}
              >
                <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IconCamera size={15} /> Cover Image URL
                </label>
                <input
                  type="url"
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  onBlur={handleCoverUrlBlur}
                  placeholder="https://images.unsplash.com/…"
                  style={{ fontSize: 13 }}
                />
              </div>
            </div>
          </div>
        )}

        {tab === 'checklists' && (
          <ChecklistSection
            workspaceId={workspaceId}
            boardId={boardId}
            cardId={card.id}
            checklists={checklists}
            onUpdated={() => {
              loadCardDetails()
              onCardUpdated()
            }}
          />
        )}

        {tab === 'comments' && (
          <CommentSection
            workspaceId={workspaceId}
            boardId={boardId}
            cardId={card.id}
            comments={comments}
            onUpdated={() => {
              loadCardDetails()
              onCardUpdated()
            }}
          />
        )}

        {tab === 'attachments' && (
          <AttachmentSection
            workspaceId={workspaceId}
            boardId={boardId}
            cardId={card.id}
            attachments={attachments}
            onUpdated={() => {
              loadCardDetails()
              onCardUpdated()
            }}
          />
        )}

        {tab === 'docs' && (
          <LinkedDocsSection
            workspaceId={workspaceId}
            cardId={card.id}
          />
        )}
      </div>
    </Modal>
  )
}
