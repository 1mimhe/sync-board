import type { BoardViewMode } from '../../../types'
import {
  IconColumns,
  IconTable,
  IconCalendar,
  IconTimeline,
} from '../../common/Icons'

export interface ViewSwitcherProps {
  activeView: BoardViewMode
  onViewChange: (view: BoardViewMode) => void
}

const VIEWS: { id: BoardViewMode; label: string; icon: typeof IconColumns }[] = [
  { id: 'board', label: 'Board', icon: IconColumns },
  { id: 'table', label: 'Table', icon: IconTable },
  { id: 'calendar', label: 'Calendar', icon: IconCalendar },
  { id: 'timeline', label: 'Timeline', icon: IconTimeline },
]

export function ViewSwitcher({ activeView, onViewChange }: ViewSwitcherProps) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: 'var(--bg3)',
        borderRadius: 10,
        padding: 3,
        border: '1px solid var(--border)',
        gap: 2,
      }}
    >
      {VIEWS.map(({ id, label, icon: Icon }) => {
        const isActive = activeView === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => onViewChange(id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 10px',
              borderRadius: 7,
              fontSize: 12.5,
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              background: isActive ? 'var(--violet)' : 'transparent',
              color: isActive ? '#fff' : 'var(--muted)',
              transition: 'all 0.15s ease',
              boxShadow: isActive ? '0 2px 8px rgba(124, 58, 237, 0.4)' : 'none',
            }}
          >
            <Icon size={14} />
            <span>{label}</span>
          </button>
        )
      })}
    </div>
  )
}
