import type { CardStatus, CardPriority } from '@prisma/client';

/**
 * Filter and sorting criteria for querying board cards in table view projection.
 */
export interface CardTableFilters {
  status?: CardStatus;
  priority?: CardPriority;
  assigneeId?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
