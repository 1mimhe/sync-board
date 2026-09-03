import { useEffect, useState, useCallback } from 'react'
import type { BoardWithContent, CardWithDetails, List } from '../../types'
import { listApi, cardApi } from '../../api/endpoints'
import { useToast } from '../../stores/toast.store'
import { Modal } from '../common/Modal'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { IconArchive, IconRefresh, IconTrash } from '../common/Icons'

export interface ArchivedItemsModalProps {
  isOpen: boolean
  onClose: () => void
  workspaceId: string
  board: BoardWithContent
  currentRole?: string
  onRestored: () => void
}

type TabKey = 'cards' | 'lists'

export function ArchivedItemsModal({
  isOpen,
  onClose,
  workspaceId,
  board,
  currentRole,
  onRestored,
}: ArchivedItemsModalProps) {
  const { addToast } = useToast()
  const [tab, setTab] = useState<TabKey>('cards')

  const [archivedCards, setArchivedCards] = useState<CardWithDetails[]>([])
  const [cardsCursor, setCardsCursor] = useState<string | null>(null)
  const [cardsHasMore, setCardsHasMore] = useState(false)
  const [cardsLoading, setCardsLoading] = useState(false)
  const [cardsLoadingMore, setCardsLoadingMore] = useState(false)

  const [archivedLists, setArchivedLists] = useState<List[]>([])
  const [listsCursor, setListsCursor] = useState<string | null>(null)
  const [listsHasMore, setListsHasMore] = useState(false)
  const [listsLoading, setListsLoading] = useState(false)
  const [listsLoadingMore, setListsLoadingMore] = useState(false)

  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [confirmDeleteCard, setConfirmDeleteCard] = useState<CardWithDetails | null>(null)
  const [confirmDeleteList, setConfirmDeleteList] = useState<List | null>(null)

  const isPrivileged = currentRole === 'owner' || currentRole === 'admin'

  const normalizePaginated = <T,>(
    raw: unknown,
    itemsKey: string = 'items',
  ): { items: T[]; cursor: string | null; hasMore: boolean } => {
    if (Array.isArray(raw)) {
      return { items: raw as T[], cursor: null, hasMore: false }
    }
    const obj = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : null
    if (obj && Array.isArray(obj[itemsKey])) {
      const pag = (obj.pagination as { cursor?: string; hasMore?: boolean } | undefined) ?? null
      return {
        items: obj[itemsKey] as T[],
        cursor: pag?.cursor ?? null,
        hasMore: !!pag?.hasMore,
      }
    }
    return { items: [], cursor: null, hasMore: false }
  }

  const loadArchivedCards = useCallback(async (nextCursor?: string | null, append = false) => {
    if (!append) setCardsLoading(true)
    else setCardsLoadingMore(true)
    const res = await cardApi.listArchived(workspaceId, board.id, { cursor: nextCursor || undefined, limit: 20 })
    if (res.success && res.data) {
      const { items, cursor, hasMore } = normalizePaginated<CardWithDetails>(res.data)
      if (append) setArchivedCards((prev) => [...prev, ...items])
      else setArchivedCards(items)
      setCardsCursor(cursor)
      setCardsHasMore(hasMore)
    }
    setCardsLoading(false)
    setCardsLoadingMore(false)
  }, [workspaceId, board.id])

  const loadArchivedLists = useCallback(async (nextCursor?: string | null, append = false) => {
    if (!append) setListsLoading(true)
    else setListsLoadingMore(true)
    const res = await listApi.listArchived(workspaceId, board.id, { cursor: nextCursor || undefined, limit: 20 })
    if (res.success && res.data) {
      const { items, cursor, hasMore } = normalizePaginated<List>(res.data)
      if (append) setArchivedLists((prev) => [...prev, ...items])
      else setArchivedLists(items)
      setListsCursor(cursor)
      setListsHasMore(hasMore)
    } else {
      // Fallback: if endpoint not available, filter from board
      const fallback = (board.lists || []).filter((l) => !!l.archivedAt) as List[]
      setArchivedLists(fallback)
      setListsHasMore(false)
    }
    setListsLoading(false)
    setListsLoadingMore(false)
  }, [workspaceId, board.id, board.lists])

  useEffect(() => {
    if (isOpen) {
      loadArchivedCards(null, false)
      loadArchivedLists(null, false)
    }
  }, [isOpen, loadArchivedCards, loadArchivedLists])

  const handleRestoreList = async (listId: string, listTitle: string) => {
    setRestoringId(listId)
    const res = await listApi.unarchive(workspaceId, board.id, listId)
    setRestoringId(null)
    if (res.success) {
      addToast(`List "${listTitle}" restored`, 'success')
      setArchivedLists((prev) => prev.filter((l) => l.id !== listId))
      onRestored()
    } else {
      addToast(res.error?.message || 'Failed to restore list', 'error')
    }
  }

  const handleRestoreCard = async (cardId: string, cardTitle: string) => {
    setRestoringId(cardId)
    const res = await cardApi.unarchive(workspaceId, board.id, cardId)
    setRestoringId(null)
    if (res.success) {
      addToast(`Card "${cardTitle}" restored`, 'success')
      setArchivedCards((prev) => prev.filter((c) => c.id !== cardId))
      onRestored()
    } else {
      addToast(res.error?.message || 'Failed to restore card', 'error')
    }
  }

  const handleDeleteCard = async () => {
    if (!confirmDeleteCard) return
    const res = await cardApi.deletePermanently(workspaceId, board.id, confirmDeleteCard.id)
    if (res.success) {
      addToast(`Card "${confirmDeleteCard.title}" permanently deleted`, 'success')
      setArchivedCards((prev) => prev.filter((c) => c.id !== confirmDeleteCard.id))
      setConfirmDeleteCard(null)
      onRestored()
    } else {
      addToast(res.error?.message || 'Failed to delete card', 'error')
    }
  }

  const handleDeleteList = async () => {
    if (!confirmDeleteList) return
    const res = await listApi.deletePermanently(workspaceId, board.id, confirmDeleteList.id)
    if (res.success) {
      addToast(`List "${confirmDeleteList.title}" permanently deleted`, 'success')
      setArchivedLists((prev) => prev.filter((l) => l.id !== confirmDeleteList.id))
      setConfirmDeleteList(null)
      onRestored()
    } else {
      addToast(res.error?.message || 'Failed to delete list', 'error')
    }
  }

  const getListTitle = (listId: string) => {
    // Search in both archived and active lists, fallback to board.lists
    const allLists = [...archivedLists, ...(board.lists || [])]
    return allLists.find((l) => l.id === listId)?.title || 'List'
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconArchive size={18} /> Archive
          </div>
        }
        maxWidth={580}
      >
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--muted2)', lineHeight: 1.5 }}>
            Archived cards and lists are hidden from the board. You can restore them or permanently delete them. Deleted items are not retrievable.
          </div>

          {/* Tab Switcher */}
          <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
            <button
              className={`btn btn-sm ${tab === 'cards' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setTab('cards')}
            >
              <IconArchive size={12} /> Archived Cards {archivedCards.length > 0 ? `(${archivedCards.length}${cardsHasMore ? '+' : ''})` : ''}
            </button>
            <button
              className={`btn btn-sm ${tab === 'lists' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setTab('lists')}
            >
              <IconArchive size={12} /> Archived Lists {archivedLists.length > 0 ? `(${archivedLists.length}${listsHasMore ? '+' : ''})` : ''}
            </button>
          </div>

          {/* Content */}
          {tab === 'cards' ? (
            <div style={{ display: 'grid', gap: 10, maxHeight: 400, overflowY: 'auto', paddingRight: 4 }}>
              {cardsLoading && (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>Loading archived cards…</div>
              )}

              {!cardsLoading &&
                archivedCards.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      background: 'var(--bg3)',
                      borderRadius: 10,
                      border: '1px solid var(--border)',
                      gap: 12,
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.title}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 2 }}>
                        In list: <b>{getListTitle(c.listId)}</b> • Archived{' '}
                        {c.archivedAt ? new Date(c.archivedAt).toLocaleDateString() : ''}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleRestoreCard(c.id, c.title)}
                        disabled={restoringId === c.id}
                        style={{ color: 'var(--violet2)' }}
                      >
                        <IconRefresh size={13} />
                        {restoringId === c.id ? 'Restoring…' : 'Restore'}
                      </button>
                      {isPrivileged && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setConfirmDeleteCard(c)}
                          style={{ color: '#ef4444' }}
                        >
                          <IconTrash size={13} />
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}

              {!cardsLoading && archivedCards.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 32, display: 'grid', gap: 8, placeItems: 'center' }}>
                  <IconArchive size={28} style={{ opacity: 0.6 }} />
                  <div>No archived cards</div>
                  <div style={{ fontSize: 12, color: 'var(--muted2)' }}>Archive a card to see it here. Restore or permanently delete it.</div>
                </div>
              )}

              {cardsHasMore && archivedCards.length > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={() => loadArchivedCards(cardsCursor, true)} disabled={cardsLoadingMore}>
                  {cardsLoadingMore ? 'Loading…' : 'Load more'}
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10, maxHeight: 400, overflowY: 'auto', paddingRight: 4 }}>
              {listsLoading && (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>Loading archived lists…</div>
              )}

              {!listsLoading &&
                archivedLists.map((l) => (
                  <div
                    key={l.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      background: 'var(--bg3)',
                      borderRadius: 10,
                      border: '1px solid var(--border)',
                      gap: 12,
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {l.title}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 2 }}>
                        Archived {l.archivedAt ? new Date(l.archivedAt).toLocaleDateString() : ''}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleRestoreList(l.id, l.title)}
                        disabled={restoringId === l.id}
                        style={{ color: 'var(--violet2)' }}
                      >
                        <IconRefresh size={13} />
                        {restoringId === l.id ? 'Restoring…' : 'Restore'}
                      </button>
                      {isPrivileged && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setConfirmDeleteList(l)}
                          style={{ color: '#ef4444' }}
                        >
                          <IconTrash size={13} />
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}

              {!listsLoading && archivedLists.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 32, display: 'grid', gap: 8, placeItems: 'center' }}>
                  <IconArchive size={28} style={{ opacity: 0.6 }} />
                  <div>No archived lists</div>
                  <div style={{ fontSize: 12, color: 'var(--muted2)' }}>Archive a list to see it here. Its cards are archived with it but not shown.</div>
                </div>
              )}

              {listsHasMore && archivedLists.length > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={() => loadArchivedLists(listsCursor, true)} disabled={listsLoadingMore}>
                  {listsLoadingMore ? 'Loading…' : 'Load more'}
                </button>
              )}
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!confirmDeleteCard}
        onClose={() => setConfirmDeleteCard(null)}
        onConfirm={handleDeleteCard}
        title="Permanently delete card?"
        confirmLabel="Delete permanently"
        confirmVariant="danger"
        message={
          confirmDeleteCard ? (
            <span>
              Card <b>{confirmDeleteCard.title}</b> will be permanently deleted and <b>not retrievable</b>. This cannot be undone.
            </span>
          ) : (
            ''
          )
        }
      />

      <ConfirmDialog
        isOpen={!!confirmDeleteList}
        onClose={() => setConfirmDeleteList(null)}
        onConfirm={handleDeleteList}
        title="Permanently delete list?"
        confirmLabel="Delete permanently"
        confirmVariant="danger"
        message={
          confirmDeleteList ? (
            <span>
              List <b>{confirmDeleteList.title}</b> and its cards will be permanently deleted and <b>not retrievable</b>. This cannot be undone.
            </span>
          ) : (
            ''
          )
        }
      />
    </>
  )
}
