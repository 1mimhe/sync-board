import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Socket } from 'socket.io-client';
import type { Notification } from '../../types';
import { notificationsApi } from '../../api/endpoints';
import { createAuthedSocket } from '../../socket/socket';
import { useToast } from '../../stores/toast.store';

function resolveNotificationRoute(n: Notification): string {
  const entityType = n.entityType ?? '';
  const entityId = n.entityId ?? '';
  const boardId = n.boardId ?? null;
  const cardId = n.cardId ?? (entityType === 'card' ? entityId : null);

  if ((entityType === 'card' || entityType === 'comment') && cardId) {
    // Board id may be absent; fall back to inbox when we cannot deep-link.
    if (boardId && n.workspaceId) {
      const base = `/workspaces/${n.workspaceId}/boards/${boardId}/cards/${cardId}`;
      if (entityType === 'comment' && entityId) return `${base}?comment=${entityId}`;
      return base;
    }
    return '/notifications';
  }
  if (entityType === 'workspace' && n.workspaceId) {
    return `/workspaces/${n.workspaceId}`;
  }
  return '/notifications';
}

export function NotificationBell() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const fetchCount = async () => {
    const res = await notificationsApi.unreadCount();
    if (res.success && res.data) setCount(res.data.count);
  };

  const fetchRecent = async () => {
    setLoading(true);
    const res = await notificationsApi.list({ limit: 10 });
    setLoading(false);
    if (res.success && res.data) setItems(res.data.items);
  };

  useEffect(() => {
    void fetchCount();
  }, []);

  useEffect(() => {
    if (!open) return;
    void fetchRecent();
  }, [open ]);

  useEffect(() => {
    const socket = createAuthedSocket();
    socketRef.current = socket;

    socket.on('notification:new', (n: Notification) => {
      setItems((prev) => (prev.some((x) => x.id === n.id) ? prev : [n, ...prev].slice(0, 10)));
      addToast(n.title || 'New notification', 'info');
      // Count frame arrives separately; refetch proactively as well.
      void fetchCount();
    });

    // Server sends { unreadCount: -1 } as a STALE hint — never render it.
    socket.on('notification:count', () => {
      void fetchCount();
    });

    const onReconnect = () => {
      void fetchCount();
      if (open) void fetchRecent();
    };
    socket.on('connect', onReconnect);

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open ]);

  const handleOpenItem = async (n: Notification) => {
    if (!n.isRead) {
      const res = await notificationsApi.markRead(n.id);
      if (res.success) {
        setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
        setCount((c) => Math.max(0, c - 1));
      }
    }
    setOpen(false);
    navigate(resolveNotificationRoute(n));
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        title="Notifications"
        aria-expanded={open}
        aria-haspopup="listbox"
        style={{ position: 'relative' }}
      >
        <span aria-hidden="true" style={{ fontSize: 16 }}>🔔</span>
        {count > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              background: '#EF4444',
              color: '#fff',
              fontSize: 11,
              fontWeight: 800,
              display: 'grid',
              placeItems: 'center',
              padding: '0 5px',
            }}
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Recent notifications"
          style={{
            position: 'absolute',
            right: 0,
            top: 40,
            width: 360,
            maxHeight: 440,
            overflowY: 'auto',
            background: 'var(--bg2)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
            zIndex: 500,
            padding: 8,
            display: 'grid',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px' }}>
            <strong style={{ fontSize: 13 }}>Notifications</strong>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setOpen(false);
                navigate('/notifications');
              }}
            >
              View all
            </button>
          </div>

          {loading && items.length === 0 && (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
              Loading…
            </div>
          )}

          {!loading && items.length === 0 && (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
              No notifications yet.
            </div>
          )}

          {items.map((n) => (
            <button
              key={n.id}
              type="button"
              role="option"
              aria-selected={!n.isRead}
              onClick={() => void handleOpenItem(n)}
              style={{
                textAlign: 'left',
                background: n.isRead ? 'transparent' : 'rgba(124,58,237,0.12)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '10px 12px',
                cursor: 'pointer',
                display: 'grid',
                gap: 4,
              }}
              title={n.title}
            >
              <span style={{ fontSize: 13, fontWeight: n.isRead ? 500 : 800, color: 'var(--text)' }}>
                {n.title}
              </span>
              {n.body && (
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{n.body}</span>
              )}
              <span style={{ fontSize: 11, color: 'var(--muted2)' }}>
                {new Date(n.createdAt).toLocaleString()}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
