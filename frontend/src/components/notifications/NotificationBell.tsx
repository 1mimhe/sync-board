import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Socket } from 'socket.io-client';
import type { Notification } from '../../types';
import { notificationsApi } from '../../api/endpoints';
import { createAuthedSocket } from '../../socket/socket';
import { useToast } from '../../stores/toast.store';
import { resolveNotificationRoute } from '../../utils';
import { IconBell } from '../common/Icons';

export function NotificationBell() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const openRef = useRef(open);
  openRef.current = open;
  const unreadOnlyRef = useRef(unreadOnly);
  unreadOnlyRef.current = unreadOnly;
  const containerRef = useRef<HTMLDivElement | null>(null);

  const fetchCount = useCallback(async () => {
    const res = await notificationsApi.unreadCount();
    if (res.success && res.data) setCount(res.data.count);
  }, []);

  const fetchRecent = useCallback(async (onlyUnread = unreadOnly) => {
    setLoading(true);
    const res = await notificationsApi.list({ limit: 10, unreadOnly: onlyUnread || undefined });
    setLoading(false);
    if (res.success && res.data) setItems(res.data.items);
  }, [unreadOnly]);

  useEffect(() => {
    void fetchCount();
  }, [fetchCount]);

  useEffect(() => {
    if (!open) return;
    void fetchRecent(unreadOnly);
  }, [open, unreadOnly, fetchRecent]);

  // Click-outside and Escape listener to close popup
  useEffect(() => {
    if (!open) return;
    const handleDown = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent && e.key === 'Escape') {
        setOpen(false);
      } else if (e instanceof MouseEvent && containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleDown);
    document.addEventListener('keydown', handleDown);
    return () => {
      document.removeEventListener('mousedown', handleDown);
      document.removeEventListener('keydown', handleDown);
    };
  }, [open]);

  // Single persistent socket hook per notification spec
  useEffect(() => {
    const socket: Socket = createAuthedSocket();

    socket.on('notification:new', (n: Notification) => {
      setItems((prev) => {
        if (prev.some((x) => x.id === n.id)) return prev;
        if (unreadOnlyRef.current && n.isRead) return prev;
        return [n, ...prev].slice(0, 10);
      });
      addToast(n.title || 'New notification', 'info');
      void fetchCount();
    });

    // Server sends { unreadCount: -1 } as a STALE hint — always refetch unread-count
    socket.on('notification:count', () => {
      void fetchCount();
    });

    socket.on('connect', () => {
      void fetchCount();
      if (openRef.current) void fetchRecent(unreadOnlyRef.current);
    });

    return () => {
      socket.disconnect();
    };
  }, [fetchCount, fetchRecent, addToast]);

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

  const handleMarkAllRead = async () => {
    const res = await notificationsApi.markAllRead();
    if (res.success) {
      setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
      setCount(0);
      addToast('All notifications marked as read', 'success');
      if (unreadOnly) {
        setItems([]);
      }
    } else {
      addToast(res.error?.message || 'Failed to mark all as read', 'error');
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        title="Notifications"
        aria-expanded={open}
        aria-haspopup="listbox"
        style={{ position: 'relative', padding: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <IconBell size={18} />
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
            width: 380,
            maxWidth: 'calc(100vw - 24px)',
            maxHeight: 'min(460px, 80vh)',
            overflowY: 'auto',
            background: 'var(--bg2)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
            zIndex: 500,
            padding: 10,
            display: 'grid',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
            <strong style={{ fontSize: 13 }}>Notifications</strong>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => void handleMarkAllRead()}
                style={{ fontSize: 11.5, padding: '2px 6px' }}
                aria-label="Mark all notifications read"
              >
                Mark all read
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setOpen(false);
                  navigate('/notifications');
                }}
                style={{ fontSize: 11.5, padding: '2px 6px' }}
                aria-label="View all notifications in inbox"
              >
                View all
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', fontSize: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={(e) => setUnreadOnly(e.target.checked)}
                aria-label="Filter unread notifications only"
              />
              Unread only
            </label>
            <span style={{ color: 'var(--muted2)', fontSize: 11 }}>
              {count} unread
            </span>
          </div>

          {loading && items.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
              Loading…
            </div>
          )}

          {!loading && items.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
              {unreadOnly ? 'No unread notifications.' : 'No notifications yet.'}
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
              aria-label={n.title}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: n.isRead ? 500 : 800, color: 'var(--text)' }}>
                  {n.title}
                </span>
                {!n.isRead && (
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: 'var(--violet)',
                      flexShrink: 0,
                    }}
                  />
                )}
              </div>
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
