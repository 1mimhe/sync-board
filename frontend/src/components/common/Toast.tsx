import { useToast } from '../../stores/toast.store'
import { IconCheck, IconClose } from './Icons'

export function ToastContainer() {
  const { toasts, removeToast } = useToast()

  if (toasts.length === 0) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => {
        const isSuccess = t.type === 'success'
        const isError = t.type === 'error'
        const isWarn = t.type === 'warning'

        const border = isSuccess
          ? 'rgba(16, 185, 129, 0.4)'
          : isError
            ? 'rgba(239, 68, 68, 0.4)'
            : isWarn
              ? 'rgba(245, 158, 11, 0.4)'
              : 'rgba(124, 58, 237, 0.4)'

        const bg = isSuccess
          ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(18, 18, 21, 0.95) 100%)'
          : isError
            ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(18, 18, 21, 0.95) 100%)'
            : isWarn
              ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(18, 18, 21, 0.95) 100%)'
              : 'linear-gradient(135deg, rgba(124, 58, 237, 0.15) 0%, rgba(18, 18, 21, 0.95) 100%)'

        return (
          <div
            key={t.id}
            className="card"
            style={{
              minWidth: 280,
              maxWidth: 420,
              padding: '12px 16px',
              background: bg,
              borderColor: border,
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              pointerEvents: 'auto',
              animation: 'toast-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {isSuccess && <IconCheck size={16} style={{ color: 'var(--emerald)' }} />}
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                {t.message}
              </span>
            </div>

            <button
              type="button"
              onClick={() => removeToast(t.id)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--muted)',
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
                padding: 4,
              }}
            >
              <IconClose size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
