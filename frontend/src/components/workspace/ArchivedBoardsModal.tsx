import { useEffect, useState } from 'react'
import type { Board } from '../../types'
import { boardApi } from '../../api/endpoints'
import { useToast } from '../../stores/toast.store'
import { Modal } from '../common/Modal'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { IconArchive, IconRefresh, IconTrash } from '../common/Icons'

export interface ArchivedBoardsModalProps {
  isOpen: boolean
  onClose: () => void
  workspaceId: string
  boards?: Board[]
  currentRole?: string
  onRestored: () => void
}

export function ArchivedBoardsModal({
  isOpen,
  onClose,
  workspaceId,
  currentRole,
  onRestored,
}: ArchivedBoardsModalProps) {
  const { addToast } = useToast()
  const [archivedBoards, setArchivedBoards] = useState<Board[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Board | null>(null)

  const isPrivileged = currentRole === 'owner' || currentRole === 'admin'

  const loadArchived = async (nextCursor?: string | null, append = false) => {
    if (!append) setLoading(true)
    else setLoadingMore(true)
    const res = await boardApi.listArchived(workspaceId, {
      cursor: nextCursor || undefined,
      limit: 20,
    })
    if (res.success && res.data) {
      // Handle both array and paginated response for backward compat
      const raw: any = res.data
      if (Array.isArray(raw)) {
        setArchivedBoards(raw)
        setCursor(null)
        setHasMore(false)
      } else if (raw.items && raw.pagination) {
        const items: Board[] = raw.items
        const pagination = raw.pagination
        if (append) {
          setArchivedBoards((prev) => [...prev, ...items])
        } else {
          setArchivedBoards(items)
        }
        setCursor(pagination.cursor ?? null)
        setHasMore(!!pagination.hasMore)
      } else {
        // Fallback: treat as array
        setArchivedBoards(Array.isArray(raw) ? raw : [])
        setHasMore(false)
      }
    }
    setLoading(false)
    setLoadingMore(false)
  }

  useEffect(() => {
    if (isOpen) {
      setCursor(null)
      setHasMore(false)
      loadArchived(null, false)
    }
  }, [isOpen, workspaceId])

  const handleRestoreBoard = async (boardId: string, boardTitle: string) => {
    setRestoringId(boardId)
    const res = await boardApi.unarchive(workspaceId, boardId)
    setRestoringId(null)

    if (res.success) {
      addToast(`Board "${boardTitle}" restored`, 'success')
      // Reload first page
      loadArchived(null, false)
      onRestored()
    } else {
      addToast(res.error?.message || 'Failed to restore board', 'error')
    }
  }

  const handleDeletePermanently = async () => {
    if (!confirmDelete) return
    const res = await boardApi.deletePermanently(workspaceId, confirmDelete.id)
    if (res.success) {
      addToast(`Board "${confirmDelete.title}" permanently deleted`, 'success')
      setConfirmDelete(null)
      // Remove from local list and reload to fill page
      setArchivedBoards((prev) => prev.filter((b) => b.id !== confirmDelete.id))
      onRestored()
    } else {
      addToast(res.error?.message || 'Failed to delete board', 'error')
    }
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconArchive size={18} /> Archive — Boards
          </div>
        }
        maxWidth={580}
      >
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--muted2)', lineHeight: 1.5 }}>
            Archived boards are hidden from your workspace. You can restore them or permanently delete them.
            Deleted boards are not retrievable.
          </div>

          {loading && (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>
              Loading archived boards…
            </div>
          )}

          {!loading && (
            <div style={{ display: 'grid', gap: 10, maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
              {archivedBoards.map((b) => (
                <div
                  key={b.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    background: 'var(--bg3)',
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        backgroundColor: b.backgroundColor || '#7c3aed',
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {b.title}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 2 }}>
                        Archived {b.archivedAt ? new Date(b.archivedAt).toLocaleDateString() : ''}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleRestoreBoard(b.id, b.title)}
                      disabled={restoringId === b.id}
                      style={{ color: 'var(--violet2)' }}
                    >
                      <IconRefresh size={13} />
                      {restoringId === b.id ? 'Restoring…' : 'Restore'}
                    </button>
                    {isPrivileged && (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setConfirmDelete(b)}
                        style={{ color: '#ef4444' }}
                        title="Permanently delete — cannot be undone"
                      >
                        <IconTrash size={13} />
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {!loading && archivedBoards.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 32, display: 'grid', gap: 8, placeItems: 'center' }}>
                  <IconArchive size={32} style={{ opacity: 0.6 }} />
                  <div>No archived boards</div>
                  <div style={{ fontSize: 12, color: 'var(--muted2)' }}>Archive a board to see it here. You can restore or permanently delete it.</div>
                </div>
              )}

              {hasMore && archivedBoards.length > 0 && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => loadArchived(cursor, true)}
                  disabled={loadingMore}
                  style={{ marginTop: 4 }}
                >
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              )}
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDeletePermanently}
        title="Permanently delete board?"
        confirmLabel="Delete permanently"
        confirmVariant="danger"
        message={
          confirmDelete ? (
            <span>
              Board <b>{confirmDelete.title}</b> and its lists/cards will be permanently deleted and <b>not retrievable</b>. This cannot be undone.
            </span>
          ) : (
            ''
          )
        }
      />
    </>
  )
}
