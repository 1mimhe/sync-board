import type { CardPriority, CardStatus } from '../../types';
import { CARD_PRIORITY_META, CARD_STATUS_META } from '../../constants';

export interface PriorityBadgeProps {
  /** Current priority value. */
  priority: CardPriority;
  /** Called when user picks a different stage. Omit for read-only. */
  onChange?: (p: CardPriority) => void;
  /** When true, renders badge only (no dropdown). */
  readonly?: boolean;
}

const PRIORITY_ORDER: CardPriority[] = ['lowest', 'low', 'medium', 'high', 'urgent'];

export function PriorityBadge({ priority, onChange, readonly }: PriorityBadgeProps) {
  const meta = CARD_PRIORITY_META[priority];

  if (readonly || !onChange) {
    return (
      <span
        title={meta.label}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          fontWeight: 700,
          color: meta.color,
        }}
      >
        <span
          aria-hidden="true"
          style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color }}
        />
        {meta.label}
      </span>
    );
  }

  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>
      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color }} />
      <select
        aria-label="Card priority"
        value={priority}
        onChange={(e) => onChange(e.target.value as CardPriority)}
        title={meta.label}
        style={{
          fontSize: 12.5,
          fontWeight: 700,
          padding: '4px 8px',
          borderRadius: 6,
          background: 'var(--bg2)',
          color: meta.color,
          border: '1px solid var(--border)',
          cursor: 'pointer',
        }}
      >
        {PRIORITY_ORDER.map((p) => (
          <option key={p} value={p}>
            {CARD_PRIORITY_META[p].label}
          </option>
        ))}
      </select>
    </label>
  );
}

export interface StatusSelectProps {
  /** Current workflow status. */
  status: CardStatus;
  /** Called when user picks a different status. Omit for read-only. */
  onChange?: (s: CardStatus) => void;
  /** When true, renders pill only (no dropdown). */
  readonly?: boolean;
}

const STATUS_ORDER: CardStatus[] = ['not_started', 'active', 'done', 'closed'];

export function StatusSelect({ status, onChange, readonly }: StatusSelectProps) {
  const meta = CARD_STATUS_META[status];
  const showStrikeHint = status === 'done' || status === 'closed';

  const pill = (
    <span
      title={meta.label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        fontWeight: 700,
        padding: '3px 10px',
        borderRadius: 8,
        background: `${meta.color}22`,
        color: meta.color,
        border: `1px solid ${meta.color}55`,
        textDecoration: showStrikeHint ? 'line-through' : 'none',
      }}
    >
      {meta.label}
      {showStrikeHint && (
        <span style={{ fontWeight: 500, textDecoration: 'none' }}>(complete)</span>
      )}
    </span>
  );

  if (readonly || !onChange) return pill;

  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>
      {pill}
      <select
        aria-label="Card status"
        value={status}
        onChange={(e) => onChange(e.target.value as CardStatus)}
        title={meta.label}
        style={{
          fontSize: 12.5,
          fontWeight: 700,
          padding: '4px 8px',
          borderRadius: 6,
          background: 'var(--bg2)',
          color: meta.color,
          border: '1px solid var(--border)',
          cursor: 'pointer',
        }}
      >
        {STATUS_ORDER.map((s) => (
          <option key={s} value={s}>
            {CARD_STATUS_META[s].label}
          </option>
        ))}
      </select>
    </label>
  );
}
