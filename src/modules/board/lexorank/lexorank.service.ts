import { Injectable } from '@nestjs/common';
import { LexoRank } from 'lexorank';
import { BusinessRuleException } from '../../../common/exceptions/app.exception';

/**
 * Service providing LexoRank calculation for drag-and-drop ordering
 * of lists and cards in constant time O(1).
 */
@Injectable()
export class LexorankService {
  /**
   * Returns default initial rank for the first item in a container.
   *
   * @returns LexoRank middle string
   */
  getInitialRank(): string {
    return LexoRank.middle().toString();
  }

  /**
   * Calculates a new rank lexicographically positioned between prevRank and nextRank.
   *
   * @param prevRank - Optional LexoRank string of item immediately before insertion point
   * @param nextRank - Optional LexoRank string of item immediately after insertion point
   * @returns Newly calculated LexoRank string
   * @throws {BusinessRuleException} If rank strings are invalid or malformed
   */
  getRankBetween(prevRank?: string | null, nextRank?: string | null): string {
    try {
      if (!prevRank && !nextRank) {
        return this.getInitialRank();
      }

      if (!prevRank && nextRank) {
        return LexoRank.parse(nextRank).genPrev().toString();
      }

      if (prevRank && !nextRank) {
        return LexoRank.parse(prevRank).genNext().toString();
      }

      const parsedPrev = LexoRank.parse(prevRank!);
      const parsedNext = LexoRank.parse(nextRank!);

      return parsedPrev.between(parsedNext).toString();
    } catch (error) {
      if (error instanceof BusinessRuleException) {
        throw error;
      }
      throw new BusinessRuleException(
        'INVALID_RANK',
        'Invalid LexoRank ordering string provided',
      );
    }
  }
}
