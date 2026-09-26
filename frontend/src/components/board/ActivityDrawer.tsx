import { useEffect, useState, useCallback } from 'react'
import type { ActivityEventItem } from '../../types'
import { activityApi } from '../../api/endpoints'
import { createAuthedSocket } from '../../socket/socket'
import { Modal } from '../common/Modal'
import { Avatar } from '../common/Avatar'
import { IconActivity } from '../common/Icons'

export interface ActivityDrawerProps {
  isOpen: boolean
  onClose: () => void
  workspaceId: string
  boardId: string
}

function activityTitle(a: ActivityEventItem): string {
  const title = a.payload?.['entityTitle']
  return typeof title === 'string' && title.length > 0 ? title : ''
}

export function ActivityDrawer({
  isOpen,
  onClose,
  workspaceId,
  boardId,
}: ActivityDrawerProps) {
  const [activities, setActivities] = useState<ActivityEventItem[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)

  const loadActivities = useCallback(
    async (nextCursor?: string | null) => {
      setLoading(true)
      const res = await activityApi.boardFeed(workspaceId, boardId, {
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
    },
    [workspaceId, boardId],
  )

  useEffect(() => {
    if (isOpen) {
      void loadActivities(null)
    }
  }, [isOpen, loadActivities])

  // 2s debounced refresh after mutations while drawer is open
  useEffect(() => {
    if (!isOpen) return

    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    const socket = createAuthedSocket()

    const handleMutation = () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        void loadActivities(null)
      }, 2000)
    }

    const mutationEvents = [
      'card:created',
      'card:updated',
      'card:moved',
      'card:archived',
      'card:comment-added',
      'card:attachment-added',
      'list:created',
      'list:moved',
      'list:updated',
    ]
    mutationEvents.forEach((evt) => socket.on(evt, handleMutation))

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      socket.disconnect()
    }
  }, [isOpen, loadActivities])

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconActivity size={18} /> Board Activity & Audit Log
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void loadActivities(null)}
            disabled={loading}
            aria-label="Refresh activity feed"
          >
            Refresh
          </button>
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
              name={a.actor?.displayName}
              avatarUrl={a.actor?.avatarUrl}
              size={32}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, lineHeight: 1.4 }}>
                <b style={{ color: '#fff' }}>{a.actor?.displayName || 'Someone'}</b>{' '}
                <span style={{ color: 'var(--muted)' }}>
                  {a.action.replace(':', ' ')}
                </span>{' '}
                <b style={{ color: 'var(--violet2)' }}>{activityTitle(a)}</b>{' '}
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
            onClick={() => void loadActivities(cursor)}
            disabled={loading}
            style={{ justifySelf: 'center', marginTop: 8 }}
            aria-label="Load more activity"
          >
            {loading ? 'Loading…' : 'Load More Activity'}
          </button>
        )}
      </div>
    </Modal>
  )
}
