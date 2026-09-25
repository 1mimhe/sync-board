import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Notification } from '../../types';
import { notificationsApi } from '../../api/endpoints';
import { useToast } from '../../stores/toast.store';
import { resolveNotificationRoute } from '../../utils';

export function NotificationList() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [items, setItems] = useState<Notification[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = async (nextCursor?: string | null, onlyUnread = unreadOnly) => {
    setLoading(true);
    const res = await notificationsApi.list({
      cursor: nextCursor || undefined,
      limit: 20,
      unreadOnly: onlyUnread || undefined,
    });
    setLoading(false);
    if (res.success && res.data) {
      setItems((prev) => (nextCursor ? [...prev, ...res.data!.items] : res.data!.items));
      setCursor(res.data.pagination.cursor || null);
      setHasMore(!!res.data.pagination.hasMore);
    } else if (!res.success) {
      addToast(res.error?.message || 'Failed to load notifications', 'error');
    }
  };

  useEffect(() => {
    void load(null, unreadOnly);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadOnly ]);

  const handleMarkAll = async () => {
    const res = await notificationsApi.markAllRead();
    if (res.success) {
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      addToast('All notifications marked as read', 'success');
    } else {
      addToast(res.error?.message || 'Failed to mark all as read', 'error');
    }
  };

  const handleOpen = async (n: Notification) => {
    if (!n.isRead) {
      const res = await notificationsApi.markRead(n.id);
      if (res.success) {
        setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      }
    }
    const target = resolveNotificationRoute(n);
    if (target === '/notifications') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      navigate(target);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 760, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900 }}>Notifications</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 13, color: 'var(--muted)', display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
            />
            Unread only
          </label>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void handleMarkAll()}>
            Mark all read
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {items.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => void handleOpen(n)}
            title={n.title}
            style={{
              textAlign: 'left',
              background: n.isRead ? 'var(--bg2)' : 'rgba(124,58,237,0.10)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '12px 14px',
              cursor: 'pointer',
              display: 'grid',
              gap: 4,
            }}
          >
            <span style={{ fontWeight: n.isRead ? 500 : 800, fontSize: 14 }}>{n.title}</span>
            {n.body && <span style={{ fontSize: 13, color: 'var(--muted)' }}>{n.body}</span>}
            <span style={{ fontSize: 11, color: 'var(--muted2)' }}>
              {n.type} • {new Date(n.createdAt).toLocaleString()}
            </span>
          </button>
        ))}

        {items.length === 0 && !loading && (
          <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>
            No notifications.
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
