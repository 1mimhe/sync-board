import { useEffect, useState } from 'react'
import type { ActivityLog } from '../../types'
import { boardApi } from '../../api/endpoints'
import { Modal } from '../common/Modal'
import { Avatar } from '../common/Avatar'
import { IconActivity } from '../common/Icons'

export interface ActivityDrawerProps {
  isOpen: boolean
  onClose: () => void
  workspaceId: string
  boardId: string
}

export function ActivityDrawer({
  isOpen,
  onClose,
  workspaceId,
  boardId,
}: ActivityDrawerProps) {
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)

  const loadActivities = async (nextCursor?: string | null) => {
    setLoading(true)
    const res = await boardApi.getActivities(workspaceId, boardId, {
      cursor: nextCursor || undefined,
      limit: 25,
    })
    setLoading(false)

    if (res.success && res.data) {
      if (nextCursor) {
        setActivities((prev) => [...prev, ...res.data!.items])
      } else {
        setActivities(res.data.items)
      }
      setCursor(res.data.pagination.cursor || null)
      setHasMore(!!res.data.pagination.hasMore)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadActivities(null)
    }
  }, [isOpen, workspaceId, boardId])

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconActivity size={18} /> Board Activity & Audit Log
        </div>
      }
      maxWidth={580}
    >
      <div style={{ display: 'grid', gap: 12 }}>
        {activities.map((a) => (
          <div
            key={a.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '12px 14px',
              background: 'var(--bg3)',
              borderRadius: 12,
              border: '1px solid var(--border)',
            }}
          >
            <Avatar
              name={a.user?.displayName}
              email={a.user?.email}
              avatarUrl={a.user?.avatarUrl}
              size={32}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, lineHeight: 1.4 }}>
                <b style={{ color: '#fff' }}>{a.user?.displayName || 'Someone'}</b>{' '}
                <span style={{ color: 'var(--muted)' }}>
                  {a.action.replace(':', ' ')}
                </span>{' '}
                <b style={{ color: 'var(--violet2)' }}>{a.entityTitle}</b>{' '}
                <span className="badge" style={{ fontSize: 10, marginLeft: 4 }}>
                  {a.entityType}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 4 }}>
                {new Date(a.createdAt).toLocaleString()}
              </div>
            </div>
          </div>
        ))}

        {activities.length === 0 && !loading && (
          <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>
            No activity recorded on this board yet.
          </div>
        )}

        {hasMore && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => loadActivities(cursor)}
            disabled={loading}
            style={{ justifySelf: 'center', marginTop: 8 }}
          >
            {loading ? 'Loading…' : 'Load More Activity'}
          </button>
        )}
      </div>
    </Modal>
  )
}
