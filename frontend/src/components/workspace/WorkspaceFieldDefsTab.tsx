import { useEffect, useState, useCallback } from 'react'
import type { CardFieldDef, CardFieldType } from '../../types'
import { cardFieldApi } from '../../api/endpoints'
import { useToast } from '../../stores/toast.store'
import { IconPlus, IconTrash } from '../common/Icons'

export interface WorkspaceFieldDefsTabProps {
  workspaceId: string
  isOwnerOrAdmin: boolean
}

const FIELD_TYPE_LABELS: Record<CardFieldType, string> = {
  text: 'Text',
  number: 'Number',
  date: 'Date',
  select: 'Dropdown Select',
  user: 'User / Assignee',
}

export function WorkspaceFieldDefsTab({
  workspaceId,
  isOwnerOrAdmin,
}: WorkspaceFieldDefsTabProps) {
  const { addToast } = useToast()
  const [defs, setDefs] = useState<CardFieldDef[]>([])
  const [loading, setLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [fieldType, setFieldType] = useState<CardFieldType>('text')
  const [optionsStr, setOptionsStr] = useState('')
  const [required, setRequired] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const loadDefs = useCallback(async () => {
    setLoading(true)
    const res = await cardFieldApi.listDefs(workspaceId)
    if (res.success && res.data) {
      setDefs(res.data)
    }
    setLoading(false)
  }, [workspaceId])

  useEffect(() => {
    loadDefs()
  }, [loadDefs])

  const handleCreateDef = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) return

    let parsedOptions: string[] | undefined
    if (fieldType === 'select') {
      parsedOptions = optionsStr
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      if (parsedOptions.length === 0) {
        addToast('Please provide at least one option for select fields', 'warning')
        return
      }
    }

    setSubmitting(true)
    const res = await cardFieldApi.createDef(workspaceId, {
      name: trimmedName,
      fieldType,
      options: parsedOptions,
      required,
    })
    setSubmitting(false)

    if (res.success) {
      setName('')
      setOptionsStr('')
      setFieldType('text')
      setRequired(false)
      setShowAddForm(false)
      addToast('Custom field definition created', 'success')
      loadDefs()
    } else {
      addToast(res.error?.message || 'Failed to create field definition', 'error')
    }
  }

  const handleDeleteDef = async (fieldId: string, fieldName: string) => {
    if (!window.confirm(`Delete field definition "${fieldName}"? All stored card values for this field will be permanently removed.`)) {
      return
    }

    const res = await cardFieldApi.deleteDef(workspaceId, fieldId)
    if (res.success) {
      addToast('Field definition deleted', 'info')
      loadDefs()
    } else {
      addToast(res.error?.message || 'Failed to delete field definition', 'error')
    }
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {/* Top Banner & Add Button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'var(--text)' }}>
            Custom Fields
          </h3>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '4px 0 0' }}>
            Define custom metadata properties across all cards in this workspace.
          </p>
        </div>

        {isOwnerOrAdmin && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            <IconPlus size={14} /> New Custom Field
          </button>
        )}
      </div>

      {/* Add Field Form */}
      {showAddForm && (
        <form
          onSubmit={handleCreateDef}
          style={{
            background: 'var(--bg3)',
            padding: 16,
            borderRadius: 'var(--radius2)',
            border: '1px solid var(--border)',
            display: 'grid',
            gap: 12,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>
            Create New Custom Field
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>
                Field Name *
              </label>
              <input
                type="text"
                required
                autoFocus
                placeholder="e.g. Story Points, Environment"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ width: '100%', fontSize: 13, marginTop: 4 }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>
                Field Type *
              </label>
              <select
                value={fieldType}
                onChange={(e) => setFieldType(e.target.value as CardFieldType)}
                style={{ width: '100%', fontSize: 13, marginTop: 4, background: 'var(--bg2)', color: 'var(--text)' }}
              >
                <option value="text">Text (Single line string)</option>
                <option value="number">Number (Numeric / Points)</option>
                <option value="date">Date (Calendar date)</option>
                <option value="select">Dropdown Select (Predefined options)</option>
                <option value="user">User (Workspace Member)</option>
              </select>
            </div>
          </div>

          {fieldType === 'select' && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>
                Select Options (comma-separated) *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Staging, Production, Dev, QA"
                value={optionsStr}
                onChange={(e) => setOptionsStr(e.target.value)}
                style={{ width: '100%', fontSize: 13, marginTop: 4 }}
              />
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              id="req-field"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              style={{ cursor: 'pointer', accentColor: 'var(--violet)' }}
            />
            <label htmlFor="req-field" style={{ fontSize: 12.5, cursor: 'pointer', color: 'var(--text)' }}>
              Mark as required on cards
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShowAddForm(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={submitting || !name.trim()}
            >
              {submitting ? 'Creating…' : 'Save Definition'}
            </button>
          </div>
        </form>
      )}

      {/* Definitions List */}
      {loading && defs.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--muted)', padding: 12 }}>Loading custom fields…</div>
      ) : defs.length === 0 ? (
        <div
          style={{
            fontSize: 13,
            color: 'var(--muted2)',
            padding: 32,
            background: 'var(--bg2)',
            borderRadius: 'var(--radius2)',
            border: '1px solid var(--border)',
            textAlign: 'center',
          }}
        >
          No custom fields defined for this workspace yet.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {defs.map((def) => {
            const raw = def.options
            const optionsList: string[] = Array.isArray(raw)
              ? (raw as string[])
              : raw && typeof raw === 'object' && 'options' in raw && Array.isArray((raw as { options: string[] }).options)
              ? (raw as { options: string[] }).options
              : []

            return (
              <div
                key={def.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: 'var(--bg2)',
                  borderRadius: 'var(--radius2)',
                  border: '1px solid var(--border)',
                  gap: 12,
                }}
              >
                <div style={{ display: 'grid', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                      {def.name}
                    </span>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: 4,
                        background: 'var(--violet-bg)',
                        color: 'var(--violet2)',
                        border: '1px solid var(--violet-border)',
                      }}
                    >
                      {FIELD_TYPE_LABELS[def.fieldType] || def.fieldType}
                    </span>
                    {def.required && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: 4,
                          background: 'rgba(239, 68, 68, 0.15)',
                          color: '#f87171',
                        }}
                      >
                        Required
                      </span>
                    )}
                  </div>

                  {optionsList.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                      {optionsList.map((opt) => (
                        <span
                          key={opt}
                          style={{
                            fontSize: 10,
                            padding: '1px 6px',
                            background: 'var(--bg3)',
                            borderRadius: 4,
                            color: 'var(--muted)',
                            border: '1px solid var(--border)',
                          }}
                        >
                          {opt}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {isOwnerOrAdmin && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ color: '#f87171' }}
                    onClick={() => handleDeleteDef(def.id, def.name)}
                    title="Delete custom field"
                  >
                    <IconTrash size={14} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
