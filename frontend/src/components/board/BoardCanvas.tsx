import React, { useEffect, useState } from 'react'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import type { BoardWithContent, Card, ListWithCards, WorkspaceMember } from '../../types'
import { listApi, cardApi } from '../../api/endpoints'
import { CardModal } from '../card/CardModal'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { Avatar } from '../common/Avatar'
import {
  IconPlus,
  IconArchive,
  IconCheckSquare,
  IconMessageSquare,
  IconPaperclip,
  IconCalendar,
} from '../common/Icons'

export interface BoardCanvasProps {
  board: BoardWithContent
  workspaceId: string
  members: WorkspaceMember[]
  filterQuery: string
  filterLabelIds: string[]
  filterAssigneeId: string | null
  onBoardUpdated: () => void
}

export function BoardCanvas({
  board,
  workspaceId,
  members,
  filterQuery,
  filterLabelIds,
  filterAssigneeId,
  onBoardUpdated,
}: BoardCanvasProps) {
  const [selectedCard, setSelectedCard] = useState<Card | null>(null)
  const [newListTitle, setNewListTitle] = useState('')
  const [isAddingList, setIsAddingList] = useState(false)
  const [cardInputs, setCardInputs] = useState<Record<string, string>>({})
  const [listToArchive, setListToArchive] = useState<ListWithCards | null>(null)

  // Optimistic local state for lists and cards to eliminate drag-and-drop glitches
  const [localLists, setLocalLists] = useState<ListWithCards[]>(board.lists || [])

  useEffect(() => {
    setLocalLists(board.lists || [])
  }, [board.lists])

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId, type } = result
    if (!destination) return

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return
    }

    if (type === 'LIST') {
      const reordered = Array.from(localLists)
      const [moved] = reordered.splice(source.index, 1)
      reordered.splice(destination.index, 0, moved)
      setLocalLists(reordered)

      const prevRank = destination.index > 0 ? reordered[destination.index - 1]?.rank : undefined
      const nextRank = destination.index < reordered.length - 1 ? reordered[destination.index + 1]?.rank : undefined

      const res = await listApi.move(workspaceId, board.id, draggableId, {
        prevRank,
        nextRank,
      })
      if (!res.success) {
        setLocalLists(board.lists || [])
      }
      onBoardUpdated()
    } else {
      const sourceList = localLists.find((l) => l.id === source.droppableId)
      const targetList = localLists.find((l) => l.id === destination.droppableId)
      if (!sourceList || !targetList) return

      const isSameList = source.droppableId === destination.droppableId
      const sourceCards = Array.from(sourceList.cards || [])
      const targetCards = isSameList ? sourceCards : Array.from(targetList.cards || [])

      const [card] = sourceCards.splice(source.index, 1)
      if (!card) return

      const movedCard = { ...card, listId: destination.droppableId }
      targetCards.splice(destination.index, 0, movedCard)

      const updatedLists = localLists.map((l) => {
        if (l.id === source.droppableId && isSameList) {
          return { ...l, cards: targetCards }
        }
        if (l.id === source.droppableId) {
          return { ...l, cards: sourceCards }
        }
        if (l.id === destination.droppableId) {
          return { ...l, cards: targetCards }
        }
        return l
      })

      setLocalLists(updatedLists)

      const prevRank = destination.index > 0 ? targetCards[destination.index - 1]?.rank : undefined
      const nextRank = destination.index < targetCards.length - 1 ? targetCards[destination.index + 1]?.rank : undefined

      const res = await cardApi.move(workspaceId, board.id, card.id, {
        targetListId: destination.droppableId,
        prevRank,
        nextRank,
      })
      if (!res.success) {
        setLocalLists(board.lists || [])
      }
      onBoardUpdated()
    }
  }

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newListTitle.trim()) return

    setIsAddingList(true)
    const res = await listApi.create(workspaceId, board.id, {
      title: newListTitle.trim(),
    })
    setIsAddingList(false)

    if (res.success) {
      setNewListTitle('')
      onBoardUpdated()
    }
  }

  const handleArchiveList = (list: ListWithCards) => {
    setListToArchive(list)
  }

  const confirmArchiveList = async () => {
    if (!listToArchive) return
    await listApi.archive(workspaceId, board.id, listToArchive.id)
    setListToArchive(null)
    onBoardUpdated()
  }

  const handleQuickAddCard = async (e: React.FormEvent, listId: string) => {
    e.preventDefault()
    const title = (cardInputs[listId] || '').trim()
    if (!title) return

    const res = await cardApi.create(workspaceId, board.id, listId, { title })
    if (res.success) {
      setCardInputs((prev) => ({ ...prev, [listId]: '' }))
      onBoardUpdated()
    }
  }

  // Filter cards helper
  const filterCards = (cards: Card[] = []) => {
    return cards.filter((card) => {
      // Text match
      if (filterQuery) {
        const q = filterQuery.toLowerCase()
        const titleMatch = card.title.toLowerCase().includes(q)
        const descMatch = (card.description || '').toLowerCase().includes(q)
        if (!titleMatch && !descMatch) return false
      }
      // Label match (multi-select: matches if card has any of the selected labels)
      if (filterLabelIds && filterLabelIds.length > 0) {
        const hasAnySelectedLabel = card.labels?.some((l) => {
          const lId = 'labelId' in l ? l.labelId : l.id
          return filterLabelIds.includes(lId)
        })
        if (!hasAnySelectedLabel) return false
      }
      // Assignee match
      if (filterAssigneeId) {
        const hasAssignee = card.assignees?.some(
          (a) => a.userId === filterAssigneeId || a.user?.id === filterAssigneeId,
        )
        if (!hasAssignee) return false
      }
      return true
    })
  }

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="board-lists" direction="horizontal" type="LIST">
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              style={{
                display: 'flex',
                gap: 16,
                overflowX: 'auto',
                paddingBottom: 16,
                minHeight: 'calc(100vh - 240px)',
                alignItems: 'flex-start',
              }}
            >
              {localLists.map((list, listIndex) => {
                const visibleCards = filterCards(list.cards)

                return (
                  <Draggable key={list.id} draggableId={list.id} index={listIndex}>
                    {(listProvided, listSnapshot) => (
                      <div
                        ref={listProvided.innerRef}
                        {...listProvided.draggableProps}
                        className="card"
                        style={{
                          width: 272,
                          minWidth: 272,
                          maxWidth: 272,
                          boxSizing: 'border-box',
                          height: 'fit-content',
                          maxHeight: 'calc(100vh - 240px)',
                          background: '#18181b',
                          display: 'flex',
                          flexDirection: 'column',
                          borderRadius: 14,
                          boxShadow: listSnapshot.isDragging
                            ? '0 16px 36px rgba(0,0,0,0.6)'
                            : '0 8px 24px rgba(0,0,0,0.3)',
                          opacity: listSnapshot.isDragging ? 0.96 : 1,
                          ...listProvided.draggableProps.style,
                        }}
                      >
                        {/* List Header / Drag Handle */}
                        <div
                          {...listProvided.dragHandleProps}
                          style={{
                            padding: '12px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            borderBottom: '1px solid var(--border)',
                            background: 'rgba(255, 255, 255, 0.02)',
                            cursor: 'grab',
                          }}
                        >
                          <input
                            defaultValue={list.title}
                            onMouseDown={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                ;(e.target as HTMLInputElement).blur()
                              }
                            }}
                            onBlur={async (e) => {
                              const val = e.target.value.trim()
                              if (val && val !== list.title) {
                                await listApi.update(workspaceId, board.id, list.id, {
                                  title: val,
                                })
                                onBoardUpdated()
                              }
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              fontWeight: 800,
                              fontSize: 14,
                              color: 'var(--text)',
                              padding: '2px 4px',
                              maxWidth: 180,
                            }}
                          />

                          <div
                            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <span className="badge" style={{ fontSize: 11, padding: '2px 7px' }}>
                              {list.cards?.length || 0}
                            </span>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '2px 4px', color: 'var(--muted2)' }}
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={() => handleArchiveList(list)}
                              title="Archive list"
                            >
                              <IconArchive size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Cards Droppable */}
                        <Droppable droppableId={list.id} type="CARD">
                          {(cardsProvided, snapshot) => (
                            <div
                              ref={cardsProvided.innerRef}
                              {...cardsProvided.droppableProps}
                              style={{
                                padding: 10,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 10,
                                minHeight: 40,
                                maxHeight: 'calc(100vh - 360px)',
                                overflowY: 'auto',
                                boxSizing: 'border-box',
                                background: snapshot.isDraggingOver
                                  ? 'rgba(124, 58, 237, 0.08)'
                                  : 'transparent',
                                transition: 'background 0.2s ease',
                              }}
                            >
                              {visibleCards.map((card, cardIndex) => (
                                <Draggable
                                  key={card.id}
                                  draggableId={card.id}
                                  index={cardIndex}
                                >
                                  {(cardProvided, cardSnapshot) => (
                                    <div
                                      ref={cardProvided.innerRef}
                                      {...cardProvided.draggableProps}
                                      {...cardProvided.dragHandleProps}
                                      onClick={() => {
                                        if (cardSnapshot.isDragging) return
                                        setSelectedCard(card)
                                      }}
                                      className="card shine"
                                      style={{
                                        padding: 12,
                                        background: cardSnapshot.isDragging
                                          ? 'rgba(39, 39, 42, 0.98)'
                                          : '#1c1c20',
                                        borderRadius: 10,
                                        cursor: 'pointer',
                                        border: cardSnapshot.isDragging
                                          ? '1px solid var(--violet)'
                                          : '1px solid var(--border)',
                                        boxShadow: cardSnapshot.isDragging
                                          ? '0 12px 30px rgba(0,0,0,0.6)'
                                          : '0 2px 8px rgba(0,0,0,0.2)',
                                        display: 'grid',
                                        gap: 8,
                                        ...cardProvided.draggableProps.style,
                                      }}
                                    >
                                      {/* Cover Preview */}
                                      {(card.coverImageUrl || card.coverUrl) && (
                                        <div
                                          style={{
                                            height: 80,
                                            borderRadius: 6,
                                            backgroundImage: `url(${card.coverImageUrl || card.coverUrl})`,
                                            backgroundSize: 'cover',
                                            backgroundPosition: 'center',
                                            marginBottom: 4,
                                          }}
                                        />
                                      )}

                                      {/* Labels Badges */}
                                      {card.labels && card.labels.length > 0 && (
                                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                          {card.labels.map((lb) => {
                                            const labelId = 'labelId' in lb ? lb.labelId : lb.id
                                            const labelName = ('label' in lb && lb.label?.name ? lb.label.name : lb.name) || ''
                                            const labelColor = ('label' in lb && lb.label?.color ? lb.label.color : lb.color) || '#7c3aed'
                                            return (
                                              <span
                                                key={labelId}
                                                className="badge"
                                                style={{
                                                  fontSize: 10.5,
                                                  padding: '2px 7px',
                                                  backgroundColor: `${labelColor}22`,
                                                  borderColor: `${labelColor}55`,
                                                  color: labelColor,
                                                  fontWeight: 700,
                                                }}
                                              >
                                                {labelName}
                                              </span>
                                            )
                                          })}
                                        </div>
                                      )}

                                      {/* Title */}
                                      {(() => {
                                        const isDone = card.isComplete ?? card.isCompleted ?? false
                                        return (
                                          <div
                                            style={{
                                              fontWeight: 700,
                                              fontSize: 13.5,
                                              lineHeight: 1.35,
                                              color: isDone ? 'var(--muted)' : 'var(--text)',
                                              textDecoration: isDone ? 'line-through' : 'none',
                                            }}
                                          >
                                            {card.title}
                                          </div>
                                        )
                                      })()}

                                      {/* Metadata Badges */}
                                      <div
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 8,
                                          flexWrap: 'wrap',
                                          fontSize: 11,
                                          color: 'var(--muted)',
                                        }}
                                      >
                                        {card.dueDate && (() => {
                                          const isDone = card.isComplete ?? card.isCompleted ?? false
                                          const isOverdue = new Date(card.dueDate) < new Date() && !isDone
                                          return (
                                            <span
                                              className="badge"
                                              style={{
                                                fontSize: 10,
                                                padding: '1px 5px',
                                                background: isOverdue ? 'rgba(239, 68, 68, 0.15)' : undefined,
                                                color: isOverdue ? '#fca5a5' : undefined,
                                                borderColor: isOverdue ? 'rgba(239, 68, 68, 0.3)' : undefined,
                                              }}
                                            >
                                              <IconCalendar size={11} />
                                              {new Date(card.dueDate).toLocaleDateString(undefined, {
                                                month: 'short',
                                                day: 'numeric',
                                              })}
                                            </span>
                                          )
                                        })()}

                                        {card.checklists && card.checklists.length > 0 && (
                                          <span className="badge" style={{ fontSize: 10, padding: '1px 5px' }}>
                                            <IconCheckSquare size={11} />
                                            {card.checklists.reduce(
                                              (acc, c) => acc + (c.items?.filter((i) => i.isDone).length || 0),
                                              0,
                                            )}
                                            /
                                            {card.checklists.reduce((acc, c) => acc + (c.items?.length || 0), 0)}
                                          </span>
                                        )}

                                        {card.comments && card.comments.length > 0 && (
                                          <span className="badge" style={{ fontSize: 10, padding: '1px 5px' }}>
                                            <IconMessageSquare size={11} /> {card.comments.length}
                                          </span>
                                        )}

                                        {card.attachments && card.attachments.length > 0 && (
                                          <span className="badge" style={{ fontSize: 10, padding: '1px 5px' }}>
                                            <IconPaperclip size={11} /> {card.attachments.length}
                                          </span>
                                        )}

                                        {/* Assignees Overlapping Avatars Stack */}
                                        {card.assignees && card.assignees.length > 0 && (
                                          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                                            {card.assignees.slice(0, 3).map((a, aIdx) => (
                                              <div
                                                key={a.userId}
                                                style={{
                                                  marginLeft: aIdx === 0 ? 0 : -6,
                                                  borderRadius: '50%',
                                                  boxShadow: '0 0 0 2px #1c1c20',
                                                  position: 'relative',
                                                  zIndex: 5 - aIdx,
                                                }}
                                              >
                                                <Avatar
                                                  name={a.user?.displayName}
                                                  email={a.user?.email}
                                                  avatarUrl={a.user?.avatarUrl}
                                                  size={22}
                                                  title={a.user?.displayName}
                                                />
                                              </div>
                                            ))}
                                            {card.assignees.length > 3 && (
                                              <span
                                                style={{
                                                  fontSize: 10,
                                                  fontWeight: 700,
                                                  color: 'var(--muted)',
                                                  marginLeft: 3,
                                                }}
                                              >
                                                +{card.assignees.length - 3}
                                              </span>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                              {cardsProvided.placeholder}
                            </div>
                          )}
                        </Droppable>

                        {/* Quick Add Card Form */}
                        <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border)' }}>
                          <form
                            onSubmit={(e) => handleQuickAddCard(e, list.id)}
                            style={{ display: 'flex', gap: 6 }}
                          >
                            <input
                              value={cardInputs[list.id] || ''}
                              onChange={(e) =>
                                setCardInputs((prev) => ({
                                  ...prev,
                                  [list.id]: e.target.value,
                                }))
                              }
                              placeholder="+ Add a card…"
                              style={{ flex: 1, fontSize: 12.5, padding: '6px 10px' }}
                            />
                            {cardInputs[list.id]?.trim() && (
                              <button className="btn btn-primary btn-sm" type="submit">
                                Add
                              </button>
                            )}
                          </form>
                        </div>
                      </div>
                    )}
                  </Draggable>
                )
              })}
              {provided.placeholder}

              {/* Add New List Column */}
              <div
                className="card"
                style={{
                  width: 220,
                  minWidth: 220,
                  maxWidth: 220,
                  padding: '8px 10px',
                  background: 'rgba(124, 58, 237, 0.05)',
                  border: '1px dashed rgba(124, 58, 237, 0.3)',
                  borderRadius: 12,
                  display: 'grid',
                  gap: 6,
                  height: 'fit-content',
                }}
              >
                <form onSubmit={handleCreateList} style={{ display: 'grid', gap: 6 }}>
                  <input
                    value={newListTitle}
                    onChange={(e) => setNewListTitle(e.target.value)}
                    placeholder="+ New list title…"
                    style={{ fontSize: 12.5, padding: '6px 10px' }}
                    required
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    type="submit"
                    disabled={isAddingList || !newListTitle.trim()}
                  >
                    <IconPlus size={14} /> Add List
                  </button>
                </form>
              </div>
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Selected Card Modal */}
      {selectedCard && (
        <CardModal
          card={selectedCard}
          workspaceId={workspaceId}
          boardId={board.id}
          members={members}
          isOpen={!!selectedCard}
          onClose={() => setSelectedCard(null)}
          onCardUpdated={onBoardUpdated}
        />
      )}

      {/* Archive List Confirmation Dialog */}
      {listToArchive && (
        <ConfirmDialog
          isOpen={!!listToArchive}
          onClose={() => setListToArchive(null)}
          onConfirm={confirmArchiveList}
          title="Archive List"
          message={`Are you sure you want to archive "${listToArchive.title}" and its ${listToArchive.cards?.length || 0} card(s)? You can restore it anytime from the Board Archive.`}
          confirmLabel="Archive List"
          confirmVariant="danger"
        />
      )}
    </>
  )
}
