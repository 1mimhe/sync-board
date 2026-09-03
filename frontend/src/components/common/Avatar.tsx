export interface AvatarProps {
  name?: string | null
  email?: string | null
  avatarUrl?: string | null
  color?: string | null
  size?: number
  isOnline?: boolean
  title?: string
}

function getInitials(name?: string | null, email?: string | null): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return parts[0].slice(0, 2).toUpperCase()
  }
  if (email && email.trim()) {
    return email.slice(0, 2).toUpperCase()
  }
  return 'U'
}

function getDeterministicColor(str?: string | null): string {
  if (!str) return '#7c3aed'
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const colors = [
    '#7c3aed',
    '#3b82f6',
    '#06b6d4',
    '#10b981',
    '#f59e0b',
    '#ef4444',
    '#ec4899',
    '#8b5cf6',
  ]
  return colors[Math.abs(hash) % colors.length]
}

export function Avatar({
  name,
  email,
  avatarUrl,
  color,
  size = 32,
  isOnline,
  title,
}: AvatarProps) {
  const initials = getInitials(name, email)
  const bg = color || getDeterministicColor(email || name)
  const tooltip = title || name || email || undefined

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: bg,
        color: '#ffffff',
        fontWeight: 700,
        fontSize: Math.max(10, Math.floor(size * 0.38)),
        userSelect: 'none',
        flexShrink: 0,
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}
      title={tooltip}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name || email || 'Avatar'}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            objectFit: 'cover',
          }}
          onError={(e) => {
            // Fallback to initials if image link breaks
            ;(e.target as HTMLElement).style.display = 'none'
          }}
        />
      ) : (
        <span>{initials}</span>
      )}

      {isOnline !== undefined && (
        <span
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: Math.max(6, Math.floor(size * 0.3)),
            height: Math.max(6, Math.floor(size * 0.3)),
            borderRadius: '50%',
            backgroundColor: isOnline ? 'var(--emerald)' : '#71717a',
            border: '2px solid #18181b',
          }}
        />
      )}
    </div>
  )
}
