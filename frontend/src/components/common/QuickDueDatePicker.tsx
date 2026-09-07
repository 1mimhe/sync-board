import { useState, useEffect, useRef } from 'react'
import { IconCalendar, IconX, IconCheck } from './Icons'

export interface QuickDueDatePickerProps {
  currentDueDate?: string | null
  onSave: (dateIso: string | null) => void
  onClose: () => void
  anchorPosition?: { top: number; left: number } | null
}

export function QuickDueDatePicker({
  currentDueDate,
  onSave,
  onClose,
  anchorPosition,
}: QuickDueDatePickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Format initial date for <input type="date" />: YYYY-MM-DD
  const formatForInput = (iso?: string | null) => {
    if (!iso) return ''
    try {
      return new Date(iso).toISOString().slice(0, 10)
    } catch {
      return ''
    }
  }

  const [dateVal, setDateVal] = useState(() => formatForInput(currentDueDate))

  // Close on Escape or click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside, true)
    }
  }, [onClose])

  const setPresetDays = (daysFromNow: number) => {
    const d = new Date()
    d.setDate(d.getDate() + daysFromNow)
    setDateVal(d.toISOString().slice(0, 10))
  }

  const handleApply = (val: string) => {
    if (!val) {
      onSave(null)
    } else {
      // Set to 23:59:59 of selected day
      const d = new Date(val)
      d.setHours(23, 59, 59, 999)
      onSave(d.toISOString())
    }
    onClose()
  }

  const handleClear = () => {
    onSave(null)
    onClose()
  }

  const isToday = (offset: number) => {
    const target = new Date()
    target.setDate(target.getDate() + offset)
    return dateVal === target.toISOString().slice(0, 10)
  }

  return (
    <div
      ref={containerRef}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: anchorPosition ? 'fixed' : 'absolute',
        top: anchorPosition ? anchorPosition.top : '100%',
        left: anchorPosition ? anchorPosition.left : 0,
        zIndex: 9999,
        width: 250,
        background: 'var(--bg2)',
        borderRadius: 'var(--radius2)',
        border: '1px solid var(--border)',
        boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
        padding: 12,
        display: 'grid',
        gap: 10,
        animation: 'fadeIn 0.15s ease',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)',
          paddingBottom: 8,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: 'var(--text)',
          }}
        >
          <IconCalendar size={13} style={{ color: 'var(--violet2)' }} /> Set Due Date
        </span>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          style={{ padding: 2, borderRadius: 4, color: 'var(--muted)' }}
          title="Close date picker"
        >
          <IconX size={13} />
        </button>
      </div>

      {/* Preset Buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <button
          type="button"
          onClick={() => {
            setPresetDays(0)
          }}
          className={`btn btn-sm ${isToday(0) ? 'btn-primary' : 'btn-ghost'}`}
          style={{ fontSize: 11, padding: '4px 6px', justifyContent: 'center' }}
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => {
            setPresetDays(1)
          }}
          className={`btn btn-sm ${isToday(1) ? 'btn-primary' : 'btn-ghost'}`}
          style={{ fontSize: 11, padding: '4px 6px', justifyContent: 'center' }}
        >
          Tomorrow
        </button>
        <button
          type="button"
          onClick={() => {
            setPresetDays(7)
          }}
          className={`btn btn-sm ${isToday(7) ? 'btn-primary' : 'btn-ghost'}`}
          style={{ fontSize: 11, padding: '4px 6px', justifyContent: 'center' }}
        >
          In 1 Week
        </button>
        <button
          type="button"
          onClick={() => {
            setPresetDays(14)
          }}
          className={`btn btn-sm ${isToday(14) ? 'btn-primary' : 'btn-ghost'}`}
          style={{ fontSize: 11, padding: '4px 6px', justifyContent: 'center' }}
        >
          In 2 Weeks
        </button>
      </div>

      {/* Native Date Input */}
      <div style={{ display: 'grid', gap: 4 }}>
        <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--muted)' }}>
          Pick Calendar Date:
        </label>
        <input
          type="date"
          value={dateVal}
          onChange={(e) => setDateVal(e.target.value)}
          style={{
            width: '100%',
            fontSize: 12.5,
            padding: '5px 8px',
            borderRadius: 6,
            background: 'var(--bg3)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            outline: 'none',
          }}
        />
      </div>

      {/* Footer Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid var(--border)',
          paddingTop: 8,
          gap: 6,
        }}
      >
        <button
          type="button"
          onClick={handleClear}
          className="btn btn-ghost btn-sm"
          style={{ fontSize: 11, padding: '3px 6px', color: '#f87171' }}
        >
          Clear Date
        </button>

        <button
          type="button"
          onClick={() => handleApply(dateVal)}
          className="btn btn-primary btn-sm"
          style={{ fontSize: 11, padding: '3px 10px', gap: 4 }}
        >
          <IconCheck size={12} /> Save
        </button>
      </div>
    </div>
  )
}
