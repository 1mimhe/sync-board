import { EntityNotFoundException } from '../../../common/exceptions/app.exception';
import type { BoardRepository } from '../core/repositories/board.repository';
import type { CardRepository } from '../card/repositories/card.repository';

/**
 * Asserts that a board exists within the workspace scope.
 *
 * @param boardRepo - Board repository
 * @param boardId - Board UUID
 * @param workspaceId - Workspace UUID scope
 * @throws {EntityNotFoundException} If board is not found
 */
export async function assertBoardInWorkspace(
  boardRepo: Pick<BoardRepository, 'findById'>,
  boardId: string,
  workspaceId?: string,
): Promise<void> {
  const board = await boardRepo.findById(boardId, workspaceId);
  if (!board) {
    throw new EntityNotFoundException('Board', boardId);
  }
}

/**
 * Asserts that an active card exists within the board scope.
 *
 * @param cardRepo - Card repository
 * @param cardId - Card UUID
 * @param boardId - Board UUID scope
 * @returns The active card
 * @throws {EntityNotFoundException} If card is not found
 */
export async function assertCardInBoard<T>(
  cardRepo: Pick<CardRepository, 'findActiveById'>,
  cardId: string,
  boardId: string,
): Promise<T> {
  const card = (await cardRepo.findActiveById(cardId, boardId)) as T | null;
  if (!card) {
    throw new EntityNotFoundException('Card', cardId);
  }
  return card;
}
