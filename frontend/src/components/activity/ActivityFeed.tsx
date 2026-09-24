import { useCallback, useEffect, useState } from 'react';
import type { ActivityEventItem } from '../../types';
import { activityApi } from '../../api/endpoints';
import { useToast } from '../../stores/toast.store';
import { Avatar } from '../common/Avatar';

export interface ActivityFeedProps {
  /** Workspace scope — required. */
  workspaceId: string;
  /** Optional board scope; when omitted the workspace-level feed is shown. */
  boardId?: string;
}

function payloadTitle(payload: Record<string, unknown>): string {
  const t = payload['entityTitle'];
  return typeof t === 'string' ? t : '';
}

export function ActivityFeed({ workspaceId, boardId }: ActivityFeedProps) {
  const { addToast } = useToast();
  const [items, setItems] = useState<ActivityEventItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [entityType, setEntityType] = useState('');
  const [actorId, setActorId] = useState('');

  const load = useCallback(
    async (nextCursor?: string | null) => {
      setLoading(true);
      const query = {
        cursor: nextCursor || undefined,
        limit: 20,
        entityType: entityType.trim() || undefined,
        actorId: actorId.trim() || undefined,
        boardId: boardId || undefined,
      };
      const res = boardId
        ? await activityApi.boardFeed(workspaceId, boardId, query)
        : await activityApi.workspaceFeed(workspaceId, query);
      setLoading(false);
      if (res.success && res.data) {
        setItems((prev) => (nextCursor ? [...prev, ...res.data!.items] : res.data!.items));
        setCursor(res.data.pagination.cursor || null);
        setHasMore(!!res.data.pagination.hasMore);
      } else if (!res.success) {
        addToast(res.error?.message || 'Failed to load activity', 'error');
      }
    },
    [workspaceId, boardId, entityType, actorId, addToast ],
  );

  useEffect(() => {
    void load(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, boardId ]);

  const handleFilter = () => {
    setCursor(null);
    void load(null);
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          flexWrap: 'wrap',
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '10px 12px',
        }}
      >
        <select
          aria-label="Filter by entity type"
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          style={{ fontSize: 12.5, background: 'var(--bg3)', color: 'var(--text)', padding: '4px 8px' }}
        >
          <option value="">All entities</option>
          <option value="card">card</option>
          <option value="board">board</option>
          <option value="document">document</option>
          <option value="list">list</option>
          <option value="workspace">workspace</option>
          <option value="comment">comment</option>
        </select>
        <input
          value={actorId}
          onChange={(e) => setActorId(e.target.value)}
          placeholder="Actor UUID (optional)"
          style={{ fontSize: 12.5, width: 220 }}
          aria-label="Filter by actor"
        />
        <button type="button" className="btn btn-ghost btn-sm" onClick={handleFilter}>
          Apply filters
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setEntityType('');
            setActorId('');
            setCursor(null);
            void load(null);
          }}
        >
          Refresh
        </button>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted2)' }}>
          {items.length} event{items.length === 1 ? '' : 's'}
        </span>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {items.map((a) => (
          <div
            key={a.id}
            style={{
              display: 'flex',
              gap: 12,
              padding: '10px 14px',
              background: 'var(--bg3)',
              borderRadius: 10,
              border: '1px solid var(--border)',
            }}
          >
            <Avatar name={a.actor?.displayName} avatarUrl={a.actor?.avatarUrl} size={30} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13 }}>
                <b>{a.actor?.displayName || 'Someone'}</b>{' '}
                <span style={{ color: 'var(--muted)' }}>{a.action.replace(':', ' ')}</span>{' '}
                <b style={{ color: 'var(--violet2)' }}>{payloadTitle(a.payload)}</b>{' '}
                <span className="badge" style={{ fontSize: 10, marginLeft: 4 }}>{a.entityType}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted2)', marginTop: 4 }}>
                {new Date(a.createdAt).toLocaleString()}
              </div>
            </div>
          </div>
        ))}

        {items.length === 0 && !loading && (
          <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 24, fontSize: 13 }}>
            No activity yet.
          </div>
        )}

        {hasMore && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={loading}
            onClick={() => void load(cursor)}
            style={{ justifySelf: 'center' }}
          >
            {loading ? 'Loading…' : 'Load more'}
          </button>
        )}
      </div>
    </div>
  );
}
