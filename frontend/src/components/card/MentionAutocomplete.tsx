import { useEffect, useState } from 'react'
import type { WorkspaceMember } from '../../types'
import { Avatar } from '../common/Avatar'

export interface MentionAutocompleteProps {
  members: WorkspaceMember[]
  query: string
  onSelect: (member: WorkspaceMember) => void
  onClose: () => void
  position?: { top: number; left: number } | null
}

export function MentionAutocomplete({
  members,
  query,
  onSelect,
  onClose,
  position,
}: MentionAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Filter members matching query
  const q = query.toLowerCase()
  const filtered = members.filter((m) => {
    const name = m.user?.displayName?.toLowerCase() || ''
    const email = m.user?.email?.toLowerCase() || ''
    return name.includes(q) || email.includes(q)
  })

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (filtered.length > 0 ? (prev + 1) % filtered.length : 0))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (filtered.length > 0 ? (prev - 1 + filtered.length) % filtered.length : 0))
      } else if (e.key === 'Enter') {
        if (filtered.length > 0 && filtered[selectedIndex]) {
          e.preventDefault()
          onSelect(filtered[selectedIndex])
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [filtered, selectedIndex, onSelect, onClose])

  if (filtered.length === 0) return null

  return (
    <div
      style={{
        position: position ? 'fixed' : 'absolute',
        top: position ? position.top : '100%',
        left: position ? position.left : 0,
        zIndex: 9999,
        width: 240,
        maxHeight: 220,
        overflowY: 'auto',
        background: 'var(--bg2)',
        borderRadius: 'var(--radius2)',
        border: '1px solid var(--border)',
        boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
        padding: 4,
        display: 'grid',
        gap: 2,
        animation: 'fadeIn 0.12s ease',
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--muted)',
          padding: '4px 8px 2px',
        }}
      >
        Mention Member
      </div>

      {filtered.map((member, idx) => {
        const isSelected = idx === selectedIndex
        return (
          <div
            key={member.userId || member.user?.id}
            onClick={() => onSelect(member)}
            onMouseEnter={() => setSelectedIndex(idx)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 8px',
              borderRadius: 6,
              background: isSelected ? 'rgba(124, 58, 237, 0.18)' : 'transparent',
              cursor: 'pointer',
              border: isSelected ? '1px solid rgba(124, 58, 237, 0.3)' : '1px solid transparent',
              transition: 'background 0.1s ease',
            }}
          >
            <Avatar
              name={member.user?.displayName}
              email={member.user?.email}
              avatarUrl={member.user?.avatarUrl}
              size={22}
            />
            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: isSelected ? 'var(--violet2)' : 'var(--text)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {member.user?.displayName || 'Member'}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: 'var(--muted2)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {member.user?.email}
              </div>
            </div>
            {member.role && (
              <span
                style={{
                  fontSize: 9.5,
                  padding: '1px 4px',
                  borderRadius: 4,
                  background: 'var(--bg3)',
                  color: 'var(--muted)',
                  textTransform: 'capitalize',
                }}
              >
                {member.role}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
