import type { CardPriority, CardStatus } from '../types';

/** Display metadata for card priorities. */
export const CARD_PRIORITY_META: Record<
  CardPriority,
  { label: string; color: string; order: number }
> = {
  lowest: { label: 'Lowest', color: '#6B7280', order: 0 },
  low: { label: 'Low', color: '#3B82F6', order: 1 },
  medium: { label: 'Medium', color: '#F59E0B', order: 2 },
  high: { label: 'High', color: '#EF4444', order: 3 },
  urgent: { label: 'Urgent', color: '#991B1B', order: 4 },
};

/** Display metadata for card statuses. */
export const CARD_STATUS_META: Record<
  CardStatus,
  { label: string; color: string; order: number }
> = {
  not_started: { label: 'Not started', color: '#6B7280', order: 0 },
  active: { label: 'Active', color: '#3B82F6', order: 1 },
  done: { label: 'Done', color: '#22C55E', order: 2 },
  closed: { label: 'Closed', color: '#111827', order: 3 },
};
