import type { BoardLabel, WorkspaceMember } from '../../types'
import { IconSearch, IconClose, IconCheck } from '../common/Icons'

export interface BoardFiltersProps {
  query: string
  onQueryChange: (q: string) => void
  selectedLabelIds: string[]
  onToggleLabel: (labelId: string) => void
  selectedAssigneeId: string | null
  onSelectAssignee: (userId: string | null) => void
  labels: BoardLabel[]
  members: WorkspaceMember[]
  onClearAll: () => void
}

export function BoardFilters({
  query,
  onQueryChange,
  selectedLabelIds,
  onToggleLabel,
  selectedAssigneeId,
  onSelectAssignee,
  labels,
  members,
  onClearAll,
}: BoardFiltersProps) {
  const hasActiveFilters = query || selectedLabelIds.length > 0 || selectedAssigneeId

  return (
    <div
      className="card"
      style={{
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap',
        background: 'rgba(24, 24, 27, 0.8)',
      }}
    >
      {/* Search Input */}
      <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Filter cards by title or description…"
          style={{ width: '100%', paddingLeft: 34, fontSize: 13 }}
        />
        <IconSearch
          size={16}
          style={{
            position: 'absolute',
            left: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--muted)',
          }}
        />
      </div>

      {/* Multi-Select Label Filter */}
      {labels.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>
            Labels ({selectedLabelIds.length > 0 ? selectedLabelIds.length : 'All'}):
          </span>
          {labels.map((lb) => {
            const isSelected = selectedLabelIds.includes(lb.id)
            return (
              <button
                key={lb.id}
                type="button"
                onClick={() => onToggleLabel(lb.id)}
                className="badge"
                style={{
                  background: isSelected ? lb.color : `${lb.color}18`,
                  color: isSelected ? '#fff' : lb.color,
                  borderColor: lb.color,
                  cursor: 'pointer',
                  fontSize: 11,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  boxShadow: isSelected ? `0 2px 8px ${lb.color}50` : 'none',
                  transition: 'all 0.15s ease',
                  fontWeight: 700,
                }}
                title={lb.name || 'Label'}
              >
                {isSelected && <IconCheck size={11} />}
                {lb.name}
              </button>
            )
          })}
        </div>
      )}

      {/* Assignee Filter */}
      {members.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Assignee:</span>
          <select
            value={selectedAssigneeId || ''}
            onChange={(e) => onSelectAssignee(e.target.value || null)}
            style={{
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              padding: '5px 10px',
              borderRadius: 8,
              fontSize: 12,
            }}
          >
            <option value="">All Assignees</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.user.displayName}
              </option>
            ))}
          </select>
        </div>
      )}

      {hasActiveFilters && (
        <button
          className="btn btn-ghost btn-sm"
          onClick={onClearAll}
          style={{ color: '#f87171', fontSize: 12 }}
        >
          <IconClose size={14} /> Clear Filters
        </button>
      )}
    </div>
  )
}
