import { useEffect, useState, useCallback } from 'react'
import type {
  Card,
  CardWithDetails,
  BoardLabel,
  WorkspaceMember,
  Checklist,
  CardComment,
  CardAttachment,
  CardPriority,
  CardStatus,
} from '../../types'
import {
  cardApi,
  labelApi,
  checklistApi,
  commentApi,
  attachmentApi,
} from '../../api/endpoints'
import { useToast } from '../../stores/toast.store'
import { isCardComplete } from '../../utils'
import { PriorityBadge, StatusSelect } from './PriorityStatus'
import { Modal } from '../common/Modal'
import { LabelPicker } from './LabelPicker'
import { AssigneePicker } from './AssigneePicker'
import { ChecklistSection } from './ChecklistSection'
import { CommentSection } from './CommentSection'
import { AttachmentSection } from './AttachmentSection'
import { LinkedDocsSection } from './LinkedDocsSection'
import { SubcardSection } from './SubcardSection'
import { TimeTrackingSection } from './TimeTrackingSection'
import { CustomFieldsSection } from './CustomFieldsSection'
import {
  IconCheckSquare,
  IconMessageSquare,
  IconPaperclip,
  IconDocument,
  IconCalendar,
  IconArchive,
  IconCamera,
  IconSubtask,
  IconClock,
  IconLink,
  IconTrash,
  IconX,
} from '../common/Icons'

export interface CardModalProps {
  card: Card
  workspaceId: string
  boardId: string
  members: WorkspaceMember[]
  isOpen: boolean
  onClose: () => void
  onCardUpdated: () => void
  allBoardCards?: Card[]
  onOpenCard?: (card: Card) => void
}

type TabType = 'overview' | 'subtasks' | 'checklists' | 'time' | 'comments' | 'attachments' | 'docs'

function parseCardDescription(desc: unknown): string {
  if (!desc) return ''
  if (typeof desc === 'string') return desc
  if (typeof desc === 'object') {
    const record = desc as Record<string, unknown>
    if (typeof record['text'] === 'string') {
      return record['text']
    }
    if (typeof record['content'] === 'string') {
      return record['content']
    }
    try {
      return JSON.stringify(desc)
    } catch {
      return ''
    }
  }
  return String(desc)
}

export function CardModal({
  card,
  workspaceId,
  boardId,
  members,
  isOpen,
  onClose,
  onCardUpdated,
  allBoardCards = [],
  onOpenCard,
}: CardModalProps) {
  const { addToast } = useToast()
  const [detail, setDetail] = useState<CardWithDetails | null>(null)
  const [boardLabels, setBoardLabels] = useState<BoardLabel[]>([])
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [comments, setComments] = useState<CardComment[]>([])
  const [attachments, setAttachments] = useState<CardAttachment[]>([])
  const [tab, setTab] = useState<TabType>('overview')

  // Form states — status is the source of truth; isCompleted is derived.
  const [title, setTitle] = useState(card.title)
  const [description, setDescription] = useState(() => parseCardDescription(card.description))
  const [dueDate, setDueDate] = useState(card.dueDate ? card.dueDate.slice(0, 10) : '')
  const [priority, setPriority] = useState<CardPriority>(card.priority || 'medium')
  const [status, setStatus] = useState<CardStatus>(card.status || 'not_started')
  const [coverUrl, setCoverUrl] = useState(card.coverUrl || '')
  const isCompleted = isCardComplete(status)

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
        setDescription(parseCardDescription(cardRes.data.description))
        setDueDate(cardRes.data.dueDate ? cardRes.data.dueDate.slice(0, 10) : '')
        if (cardRes.data.priority) setPriority(cardRes.data.priority)
        if (cardRes.data.status) setStatus(cardRes.data.status)
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
    } catch {
      addToast('Failed to load full card details', 'error')
    }
  }, [workspaceId, boardId, card.id, addToast])

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
    if (description === parseCardDescription(detail?.description)) return
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
    const nextStatus: CardStatus = isCompleted ? 'not_started' : 'done'
    setStatus(nextStatus)
    await cardApi.updateStatus(workspaceId, boardId, card.id, { status: nextStatus })
    onCardUpdated()
  }

  const handleChangeStatus = async (nextStatus: CardStatus) => {
    setStatus(nextStatus)
    const res = await cardApi.updateStatus(workspaceId, boardId, card.id, { status: nextStatus })
    if (res.success) {
      addToast(`Status updated to ${nextStatus.replace('_', ' ')}`, 'success')
      onCardUpdated()
    } else {
      addToast(res.error?.message || 'Failed to update status', 'error')
    }
  }

  const handleChangePriority = async (nextPriority: CardPriority) => {
    setPriority(nextPriority)
    const res = await cardApi.updatePriority(workspaceId, boardId, card.id, { priority: nextPriority })
    if (res.success) {
      addToast(`Priority set to ${nextPriority}`, 'success')
      onCardUpdated()
    } else {
      addToast(res.error?.message || 'Failed to update priority', 'error')
    }
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

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    addToast('Card link copied to clipboard', 'info')
  }

  const handleDeleteCard = async () => {
    if (!window.confirm(`Permanently delete "${current.title}"? This cannot be undone.`)) return
    const res = await cardApi.deletePermanently(workspaceId, boardId, card.id)
    if (res.success) {
      addToast('Card permanently deleted', 'info')
      onClose()
      onCardUpdated()
    } else {
      addToast(res.error?.message || 'Failed to delete card', 'error')
    }
  }

  const current = detail || card
  const isOverdue = dueDate && new Date(dueDate) < new Date() && !isCompleted
  const parentCardId = detail?.parentCardId !== undefined ? detail.parentCardId : card.parentCardId
  const parentCard = parentCardId ? allBoardCards.find((c) => c.id === parentCardId) : undefined
  const isSubcard = !!parentCardId

  const handleDetachFromParent = async () => {
    const res = await cardApi.detachSubcard(workspaceId, boardId, card.id)
    if (res.success) {
      addToast('Card detached from parent (now a top-level card)', 'success')
      if (detail) {
        setDetail({ ...detail, parentCardId: null })
      }
      onCardUpdated()
    } else {
      addToast(res.error?.message || 'Failed to detach from parent', 'error')
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth={840}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={handleCopyLink}
            title="Copy link to card"
          >
            <IconLink size={14} />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ color: 'var(--muted)' }}
            onClick={handleArchiveCard}
            title="Archive card"
          >
            <IconArchive size={14} /> Archive
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ color: '#f87171' }}
            onClick={handleDeleteCard}
            title="Permanently delete card"
          >
            <IconTrash size={14} />
          </button>
        </div>
      }
    >
      <div style={{ display: 'grid', gap: 18 }}>
        {/* Parent Card Breadcrumb Banner */}
        {parentCardId && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              padding: '8px 12px',
              background: 'rgba(124, 58, 237, 0.08)',
              borderRadius: 'var(--radius)',
              border: '1px solid rgba(124, 58, 237, 0.25)',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <IconSubtask size={15} style={{ color: 'var(--violet2)' }} />
              <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Subtask of:</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  if (parentCard && onOpenCard) {
                    onOpenCard(parentCard)
                  }
                }}
                disabled={!parentCard || !onOpenCard}
                style={{
                  padding: '2px 8px',
                  fontWeight: 700,
                  color: 'var(--violet2)',
                  background: 'rgba(124, 58, 237, 0.15)',
                  fontSize: 12.5,
                  cursor: parentCard && onOpenCard ? 'pointer' : 'default',
                }}
                title={parentCard ? `Open parent card "${parentCard.title}"` : 'Parent card'}
              >
                {parentCard ? parentCard.title : 'Parent Card'} &rarr;
              </button>
            </div>

            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleDetachFromParent}
              style={{ fontSize: 11.5, color: '#f87171', padding: '2px 8px' }}
              title="Detach this subcard from its parent (converts to standalone card)"
            >
              Detach from Parent
            </button>
          </div>
        )}
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

        {/* Status & Priority Ribbon — single source CARD_*_META */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '10px 14px',
            background: 'var(--bg3)',
            borderRadius: 'var(--radius2)',
            border: '1px solid var(--border)',
            flexWrap: 'wrap',
          }}
        >
          <StatusSelect status={status} onChange={(s) => void handleChangeStatus(s)} />

          <PriorityBadge priority={priority} onChange={(p) => void handleChangePriority(p)} />

          {/* Due Date in Ribbon */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <IconCalendar size={13} /> Due:
            </span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => handleDueDateChange(e.target.value)}
              style={{
                fontSize: 12,
                padding: '3px 8px',
                borderRadius: 6,
                background: 'var(--bg2)',
                border: '1px solid var(--border)',
                color: isOverdue ? '#fca5a5' : 'var(--text)',
                cursor: 'pointer',
              }}
            />
            {dueDate && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => handleDueDateChange('')}
                style={{ padding: '2px 4px', fontSize: 10, color: '#f87171' }}
                title="Clear due date"
              >
                <IconX size={11} />
              </button>
            )}
          </div>
        </div>

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
            className={`btn btn-sm ${tab === 'subtasks' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTab('subtasks')}
          >
            <IconSubtask size={14} /> Subtasks {current.subcards?.length ? `(${current.subcards.length})` : ''}
          </button>
          <button
            className={`btn btn-sm ${tab === 'checklists' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTab('checklists')}
          >
            <IconCheckSquare size={14} /> Checklists ({checklists.length})
          </button>
          <button
            className={`btn btn-sm ${tab === 'time' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTab('time')}
          >
            <IconClock size={14} /> Time Tracking
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

            {/* Custom Fields Section */}
            <div style={{ display: 'grid', gap: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>
                Custom Fields
              </label>
              <CustomFieldsSection
                workspaceId={workspaceId}
                boardId={boardId}
                cardId={card.id}
                members={members}
                onCardUpdated={() => {
                  loadCardDetails()
                  onCardUpdated()
                }}
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

        {tab === 'subtasks' && (
          <SubcardSection
            workspaceId={workspaceId}
            boardId={boardId}
            parentCard={current}
            allBoardCards={allBoardCards}
            onOpenCard={onOpenCard}
            onCardUpdated={() => {
              loadCardDetails()
              onCardUpdated()
            }}
          />
        )}

        {tab === 'checklists' && (
          <ChecklistSection
            workspaceId={workspaceId}
            boardId={boardId}
            cardId={card.id}
            checklists={checklists}
            isSubcard={isSubcard}
            onUpdated={() => {
              loadCardDetails()
              onCardUpdated()
            }}
          />
        )}

        {tab === 'time' && (
          <TimeTrackingSection
            workspaceId={workspaceId}
            boardId={boardId}
            card={current}
            members={members}
            onCardUpdated={() => {
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
            members={members}
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
