import type { CardAssignee, WorkspaceMember } from '../../types'
import { cardApi } from '../../api/endpoints'
import { Avatar } from '../common/Avatar'
import { IconUsers } from '../common/Icons'

export interface AssigneePickerProps {
  workspaceId: string
  boardId: string
  cardId: string
  assignees: CardAssignee[]
  members: WorkspaceMember[]
  onUpdated: () => void
}

export function AssigneePicker({
  workspaceId,
  boardId,
  cardId,
  assignees,
  members,
  onUpdated,
}: AssigneePickerProps) {
  const isAssigned = (userId: string) => {
    return assignees.some((a) => a.userId === userId || a.user?.id === userId)
  }

  const handleToggleAssignee = async (userId: string) => {
    if (isAssigned(userId)) {
      await cardApi.removeAssignee(workspaceId, boardId, cardId, userId)
    } else {
      await cardApi.addAssignee(workspaceId, boardId, cardId, userId)
    }
    onUpdated()
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconUsers size={15} /> Assignees
        </span>
      </div>

      {/* Selected Assignees Pills */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {assignees.map((a) => {
          const name = a.user?.displayName || a.userId
          return (
            <span
              key={a.userId}
              className="badge"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '3px 8px 3px 4px',
              }}
            >
              <Avatar
                name={a.user?.displayName}
                email={a.user?.email}
                avatarUrl={a.user?.avatarUrl}
                size={20}
              />
              <span style={{ fontSize: 12 }}>{name}</span>
              <button
                type="button"
                onClick={() => handleToggleAssignee(a.userId)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--muted)',
                  cursor: 'pointer',
                  fontSize: 13,
                  marginLeft: 2,
                  display: 'grid',
                  placeItems: 'center',
                }}
                title="Unassign user"
              >
                ×
              </button>
            </span>
          )
        })}

        {assignees.length === 0 && (
          <span style={{ fontSize: 12, color: 'var(--muted2)' }}>No one assigned yet.</span>
        )}
      </div>

      {/* Quick Assign Dropdown */}
      <div>
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) {
              handleToggleAssignee(e.target.value)
            }
          }}
          style={{
            background: 'var(--bg3)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            padding: '6px 12px',
            borderRadius: 8,
            fontSize: 12.5,
            width: '100%',
          }}
        >
          <option value="">+ Assign team member…</option>
          {members.map((m) => {
            const assigned = isAssigned(m.userId)
            return (
              <option key={m.userId} value={m.userId}>
                {assigned ? '✓ ' : '+ '} {m.user.displayName} ({m.user.email})
              </option>
            )
          })}
        </select>
      </div>
    </div>
  )
}
