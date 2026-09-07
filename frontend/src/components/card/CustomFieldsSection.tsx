import { useEffect, useState, useCallback } from 'react'
import type { CardFieldDef, WorkspaceMember } from '../../types'
import { cardFieldApi } from '../../api/endpoints'
import { useToast } from '../../stores/toast.store'

export interface CustomFieldsSectionProps {
  workspaceId: string
  boardId: string
  cardId: string
  members: WorkspaceMember[]
  onCardUpdated: () => void
}

export function CustomFieldsSection({
  workspaceId,
  boardId,
  cardId,
  members,
  onCardUpdated,
}: CustomFieldsSectionProps) {
  const { addToast } = useToast()
  const [defs, setDefs] = useState<CardFieldDef[]>([])
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(false)
  const [savingFieldId, setSavingFieldId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [defsRes, valuesRes] = await Promise.all([
        cardFieldApi.listDefs(workspaceId),
        cardFieldApi.getCardValues(workspaceId, boardId, cardId),
      ])

      if (defsRes.success && defsRes.data) {
        setDefs(defsRes.data)
      }

      if (valuesRes.success && valuesRes.data) {
        const map: Record<string, unknown> = {}
        for (const item of valuesRes.data) {
          map[item.fieldId] = item.value
        }
        setValues(map)
      }
    } catch (err) {
      console.error('Failed to load custom fields', err)
    }
    setLoading(false)
  }, [workspaceId, boardId, cardId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSaveValue = async (fieldId: string, value: unknown) => {
    setSavingFieldId(fieldId)
    // Update local optimistic state
    setValues((prev) => ({ ...prev, [fieldId]: value }))

    const res = await cardFieldApi.setCardValue(
      workspaceId,
      boardId,
      cardId,
      fieldId,
      value === '' ? null : value,
    )

    setSavingFieldId(null)
    if (res.success) {
      onCardUpdated()
    } else {
      addToast(res.error?.message || 'Failed to update field value', 'error')
      // reload original data on error
      loadData()
    }
  }

  if (loading && defs.length === 0) {
    return <div style={{ fontSize: 12, color: 'var(--muted)', padding: 8 }}>Loading fields…</div>
  }

  if (defs.length === 0) {
    return (
      <div
        style={{
          fontSize: 12,
          color: 'var(--muted2)',
          padding: '10px 14px',
          background: 'var(--bg3)',
          borderRadius: 'var(--radius2)',
          textAlign: 'center',
        }}
      >
        No custom fields defined in this workspace. Configure them in Workspace Settings.
      </div>
    )
  }

  const controlStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    fontSize: 13,
    padding: '6px 10px',
    borderRadius: 'var(--radius2)',
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    color: 'var(--text)',
    outline: 'none',
    textOverflow: 'ellipsis',
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 12,
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}
    >
      {defs.map((def) => {
        const val = values[def.id]
        const isSaving = savingFieldId === def.id

        // Parse options for select fields
        const rawOptions = def.options
        const selectOptions: string[] = Array.isArray(rawOptions)
          ? (rawOptions as string[])
          : rawOptions && typeof rawOptions === 'object' && 'options' in rawOptions && Array.isArray((rawOptions as { options: string[] }).options)
          ? (rawOptions as { options: string[] }).options
          : []

        return (
          <div
            key={def.id}
            style={{
              display: 'grid',
              gap: 6,
              padding: '10px 12px',
              background: 'var(--bg3)',
              borderRadius: 'var(--radius2)',
              border: '1px solid var(--border)',
              minWidth: 0,
              boxSizing: 'border-box',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 0 }}>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  minWidth: 0,
                }}
                title={def.name}
              >
                {def.name}
                {def.required && <span style={{ color: 'var(--red)', marginLeft: 2 }}>*</span>}
              </label>
              {isSaving && <span style={{ fontSize: 10, color: 'var(--violet2)', flexShrink: 0, marginLeft: 4 }}>Saving…</span>}
            </div>

            {/* Field Type Specific Controls */}
            {def.fieldType === 'text' && (
              <input
                type="text"
                value={typeof val === 'string' ? val : ''}
                placeholder="Empty…"
                onChange={(e) => setValues((prev) => ({ ...prev, [def.id]: e.target.value }))}
                onBlur={(e) => handleSaveValue(def.id, e.target.value)}
                style={controlStyle}
              />
            )}

            {def.fieldType === 'number' && (
              <input
                type="number"
                value={typeof val === 'number' ? val : val === '' ? '' : ''}
                placeholder="0"
                onChange={(e) => {
                  const n = e.target.value === '' ? '' : Number(e.target.value)
                  setValues((prev) => ({ ...prev, [def.id]: n }))
                }}
                onBlur={(e) => {
                  const n = e.target.value === '' ? null : Number(e.target.value)
                  handleSaveValue(def.id, n)
                }}
                style={controlStyle}
              />
            )}

            {def.fieldType === 'date' && (
              <input
                type="date"
                value={typeof val === 'string' && val ? val.slice(0, 10) : ''}
                onChange={(e) => handleSaveValue(def.id, e.target.value ? new Date(e.target.value).toISOString() : null)}
                style={controlStyle}
              />
            )}

            {def.fieldType === 'select' && (
              <select
                value={typeof val === 'string' ? val : ''}
                onChange={(e) => handleSaveValue(def.id, e.target.value || null)}
                style={controlStyle}
              >
                <option value="">(None)</option>
                {selectOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            )}

            {def.fieldType === 'user' && (
              <select
                value={typeof val === 'string' ? val : ''}
                onChange={(e) => handleSaveValue(def.id, e.target.value || null)}
                style={controlStyle}
              >
                <option value="">(Unassigned)</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.user.displayName}
                  </option>
                ))}
              </select>
            )}
          </div>
        )
      })}
    </div>
  )
}
