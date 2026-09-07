import {
  assertBoardInWorkspace,
  assertCardInBoard,
} from '../board-access.util';
import { EntityNotFoundException } from '../../../../common/exceptions/app.exception';

describe('board-access.util', () => {
  describe('assertBoardInWorkspace', () => {
    it('should resolve when board exists', async () => {
      const boardRepo = {
        findById: jest.fn().mockResolvedValue({ id: 'b-1' }),
      };
      await expect(
        assertBoardInWorkspace(boardRepo, 'b-1', 'w-1'),
      ).resolves.toBeUndefined();
      expect(boardRepo.findById).toHaveBeenCalledWith('b-1', 'w-1');
    });

    it('should throw EntityNotFoundException when board is missing', async () => {
      const boardRepo = { findById: jest.fn().mockResolvedValue(null) };
      await expect(
        assertBoardInWorkspace(boardRepo, 'b-x', 'w-1'),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });
  });

  describe('assertCardInBoard', () => {
    it('should return card when found', async () => {
      const card = { id: 'c-1' };
      const cardRepo = { findActiveById: jest.fn().mockResolvedValue(card) };
      await expect(assertCardInBoard(cardRepo, 'c-1', 'b-1')).resolves.toEqual(
        card,
      );
      expect(cardRepo.findActiveById).toHaveBeenCalledWith('c-1', 'b-1');
    });

    it('should throw EntityNotFoundException when card is missing', async () => {
      const cardRepo = { findActiveById: jest.fn().mockResolvedValue(null) };
      await expect(
        assertCardInBoard(cardRepo, 'c-x', 'b-1'),
      ).rejects.toBeInstanceOf(EntityNotFoundException);
    });
  });
});
