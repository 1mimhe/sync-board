import { useEffect, useState, useCallback } from 'react'
import type { Card, CardTimeEntry, TimeTrackingSummary, WorkspaceMember } from '../../types'
import { cardTimeApi } from '../../api/endpoints'
import { useToast } from '../../stores/toast.store'
import { Avatar } from '../common/Avatar'
import { IconClock, IconPlus, IconEdit } from '../common/Icons'

export interface TimeTrackingSectionProps {
  workspaceId: string
  boardId: string
  card: Card
  onCardUpdated: () => void
  members?: WorkspaceMember[]
}

function formatMinutes(mins: number): string {
  if (mins <= 0) return '0m'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

export function TimeTrackingSection({
  workspaceId,
  boardId,
  card,
  onCardUpdated,
  members = [],
}: TimeTrackingSectionProps) {
  const { addToast } = useToast()
  const [summary, setSummary] = useState<TimeTrackingSummary | null>(null)
  const [entries, setEntries] = useState<CardTimeEntry[]>([])
  const [loading, setLoading] = useState(false)

  // Estimate edit state
  const [isEditingEstimate, setIsEditingEstimate] = useState(false)
  const [estimateInput, setEstimateInput] = useState(
    card.estimateMinutes !== undefined && card.estimateMinutes !== null
      ? String(card.estimateMinutes)
      : '',
  )

  // Log time state
  const [showLogForm, setShowLogForm] = useState(false)
  const [logMinutesInput, setLogMinutesInput] = useState('')
  const [logNoteInput, setLogNoteInput] = useState('')
  const [logging, setLogging] = useState(false)

  const loadEntries = useCallback(async () => {
    setLoading(true)
    const res = await cardTimeApi.getTimeTracking(workspaceId, boardId, card.id, { limit: 50 })
    if (res.success && res.data) {
      setSummary(res.data)
      setEntries(res.data.entries?.items || [])
    }
    setLoading(false)
  }, [workspaceId, boardId, card.id])

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  const handleSaveEstimate = async () => {
    const val = estimateInput.trim()
    const num = val === '' ? null : Number(val)
    if (num !== null && (Number.isNaN(num) || num < 0)) {
      addToast('Estimate must be a positive number of minutes', 'warning')
      return
    }

    const res = await cardTimeApi.setEstimate(workspaceId, boardId, card.id, {
      estimateMinutes: num,
    })

    if (res.success) {
      setIsEditingEstimate(false)
      addToast('Estimate updated', 'success')
      onCardUpdated()
    } else {
      addToast(res.error?.message || 'Failed to update estimate', 'error')
    }
  }

  const handleLogTime = async (e: React.FormEvent) => {
    e.preventDefault()
    const mins = Number(logMinutesInput)
    if (!mins || mins <= 0 || mins > 1440) {
      addToast('Please enter minutes between 1 and 1440 (24h)', 'warning')
      return
    }

    setLogging(true)
    const res = await cardTimeApi.logTime(workspaceId, boardId, card.id, {
      minutes: mins,
      note: logNoteInput.trim() || undefined,
    })
    setLogging(false)

    if (res.success) {
      setLogMinutesInput('')
      setLogNoteInput('')
      setShowLogForm(false)
      addToast('Time logged successfully', 'success')
      await loadEntries()
      onCardUpdated()
    } else {
      addToast(res.error?.message || 'Failed to log time', 'error')
    }
  }

  const logged = summary?.logged ?? card.loggedMinutes ?? 0
  const estimate = summary?.estimate !== undefined ? summary.estimate : card.estimateMinutes
  const remaining =
    summary?.remaining !== undefined
      ? summary.remaining
      : estimate !== null && estimate !== undefined
      ? Math.max(0, estimate - logged)
      : 0
  const hasEstimate = estimate !== null && estimate !== undefined && estimate > 0
  const percent = hasEstimate ? Math.min(100, Math.round((logged / estimate) * 100)) : 0
  const isOverEstimate = hasEstimate && logged > estimate

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Summary Meter Card */}
      <div
        style={{
          background: 'var(--bg3)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius2)',
          padding: 16,
          display: 'grid',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconClock size={18} style={{ color: 'var(--violet)' }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                Time Tracking
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                Logged: <strong>{formatMinutes(logged)}</strong>
                {hasEstimate ? ` of ${formatMinutes(estimate)} estimate` : ' (No estimate set)'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setIsEditingEstimate(!isEditingEstimate)}
            >
              <IconEdit size={13} /> {hasEstimate ? 'Edit Estimate' : 'Set Estimate'}
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setShowLogForm(!showLogForm)}
            >
              <IconPlus size={13} /> Log Work
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        {hasEstimate && (
          <div style={{ display: 'grid', gap: 4 }}>
            <div
              style={{
                height: 8,
                background: 'var(--bg4)',
                borderRadius: 4,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${percent}%`,
                  background: isOverEstimate
                    ? 'var(--red)'
                    : percent === 100
                    ? 'var(--emerald)'
                    : 'var(--violet)',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted2)' }}>
              <span>{percent}% consumed</span>
              {isOverEstimate ? (
                <span style={{ color: 'var(--red)', fontWeight: 700 }}>
                  Over estimate by {formatMinutes(logged - estimate)}
                </span>
              ) : (
                <span>Remaining: {formatMinutes(remaining)}</span>
              )}
            </div>
          </div>
        )}

        {/* Edit Estimate Box */}
        {isEditingEstimate && (
          <div
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              paddingTop: 8,
              borderTop: '1px solid var(--border)',
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Estimate (minutes):</span>
            <input
              type="number"
              min="0"
              placeholder="e.g. 120"
              value={estimateInput}
              onChange={(e) => setEstimateInput(e.target.value)}
              style={{ width: 110, fontSize: 13, padding: '4px 8px' }}
            />
            <button type="button" className="btn btn-primary btn-sm" onClick={handleSaveEstimate}>
              Save
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setIsEditingEstimate(false)}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Log Time Box */}
        {showLogForm && (
          <form
            onSubmit={handleLogTime}
            style={{
              display: 'grid',
              gap: 8,
              paddingTop: 10,
              borderTop: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 120px' }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>
                  Minutes Spent *
                </label>
                <input
                  type="number"
                  min="1"
                  max="1440"
                  required
                  autoFocus
                  placeholder="e.g. 45"
                  value={logMinutesInput}
                  onChange={(e) => setLogMinutesInput(e.target.value)}
                  style={{ width: '100%', fontSize: 13, marginTop: 2 }}
                />
              </div>

              <div style={{ flex: '2 1 200px' }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>
                  Optional Note / Work Done
                </label>
                <input
                  type="text"
                  placeholder="e.g. Implemented review comments"
                  value={logNoteInput}
                  onChange={(e) => setLogNoteInput(e.target.value)}
                  style={{ width: '100%', fontSize: 13, marginTop: 2 }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowLogForm(false)}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={logging}>
                {logging ? 'Logging…' : 'Record Time'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Time Log History */}
      <div style={{ display: 'grid', gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>
          Logged Time History ({entries.length})
        </div>

        {loading && entries.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--muted)', padding: 8 }}>Loading history…</div>
        ) : entries.length === 0 ? (
          <div
            style={{
              fontSize: 12,
              color: 'var(--muted2)',
              padding: '12px 14px',
              background: 'var(--bg3)',
              borderRadius: 'var(--radius2)',
              textAlign: 'center',
            }}
          >
            No time entries recorded on this card yet.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {entries.map((entry) => {
              const userObj = entry.user || members.find((m) => m.userId === entry.userId)?.user
              const displayName = userObj?.displayName || 'Team Member'
              const avatarUrl = userObj?.avatarUrl

              return (
                <div
                  key={entry.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: 'var(--bg3)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius2)',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                    <Avatar
                      name={displayName}
                      avatarUrl={avatarUrl}
                      size={24}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                          {displayName}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--muted2)' }}>
                          {new Date(entry.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      {entry.note && (
                        <div
                          style={{
                            fontSize: 12,
                            color: 'var(--muted)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {entry.note}
                        </div>
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: 'var(--violet-bg)',
                      color: 'var(--violet2)',
                      border: '1px solid var(--violet-border)',
                      flexShrink: 0,
                    }}
                  >
                    +{formatMinutes(entry.minutes)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
