import { CardController } from '../../controllers/card.controller';
import { CardService } from '../../services/card.service';
import type { JwtPayload } from '../../../auth/interfaces/jwt-payload.interface';

describe('CardController', () => {
  let controller: CardController;
  let cardService: jest.Mocked<CardService>;

  const mockUser: JwtPayload = {
    sub: 'user-uuid-1',
    email: 'user@test.com',
    jti: 'jti-1',
  };

  const mockCard = {
    id: 'card-1',
    listId: 'list-1',
    title: 'Implement Auth',
    description: 'JWT Dual token',
    rank: '0|hzzzzz:',
    dueDate: null,
    isComplete: false,
    coverImageUrl: null,
    createdBy: 'user-uuid-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    archivedAt: null,
  };

  const mockCardWithDetails = {
    ...mockCard,
    assignees: [],
    labels: [],
    attachments: [],
  };

  beforeEach(() => {
    cardService = {
      create: jest.fn(),
      getCardDetails: jest.fn(),
      update: jest.fn(),
      move: jest.fn(),
      archive: jest.fn(),
      unarchive: jest.fn(),
      addAssignee: jest.fn(),
      removeAssignee: jest.fn(),
      addLabel: jest.fn(),
      removeLabel: jest.fn(),
    } as unknown as jest.Mocked<CardService>;

    controller = new CardController(cardService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('create', () => {
    it('should create card with details and map response', async () => {
      cardService.create.mockResolvedValue(mockCardWithDetails as any);

      const result = await controller.create(
        'ws-1',
        'board-1',
        'list-1',
        { title: 'Implement Auth' },
        mockUser,
      );

      expect(cardService.create).toHaveBeenCalledWith(
        'board-1',
        'ws-1',
        'list-1',
        { title: 'Implement Auth' },
        'user-uuid-1',
      );
      expect(result.id).toBe('card-1');
      expect(result.title).toBe('Implement Auth');
    });
  });

  describe('getOne', () => {
    it('should retrieve full card details', async () => {
      cardService.getCardDetails.mockResolvedValue(mockCardWithDetails as any);

      const result = await controller.getOne('ws-1', 'board-1', 'card-1');

      expect(cardService.getCardDetails).toHaveBeenCalledWith('board-1', 'ws-1', 'card-1');
      expect(result.id).toBe('card-1');
    });
  });

  describe('update', () => {
    it('should update card fields', async () => {
      cardService.update.mockResolvedValue({ ...mockCard, title: 'Updated Card' } as any);

      const result = await controller.update(
        'ws-1',
        'board-1',
        'card-1',
        { title: 'Updated Card' },
        mockUser,
      );

      expect(cardService.update).toHaveBeenCalledWith(
        'board-1',
        'ws-1',
        'card-1',
        { title: 'Updated Card' },
        'user-uuid-1',
      );
      expect(result.title).toBe('Updated Card');
    });
  });

  describe('move', () => {
    it('should move/reorder card', async () => {
      cardService.move.mockResolvedValue({ ...mockCard, rank: '0|i:' } as any);

      const result = await controller.move(
        'ws-1',
        'board-1',
        'card-1',
        { targetListId: 'list-2' },
        mockUser,
      );

      expect(cardService.move).toHaveBeenCalledWith(
        'board-1',
        'ws-1',
        'card-1',
        { targetListId: 'list-2' },
        'user-uuid-1',
      );
      expect(result.rank).toBe('0|i:');
    });
  });

  describe('archive and unarchive', () => {
    it('should archive card', async () => {
      cardService.archive.mockResolvedValue(undefined as any);

      await controller.archive('ws-1', 'board-1', 'card-1', mockUser);

      expect(cardService.archive).toHaveBeenCalledWith('board-1', 'ws-1', 'card-1', 'user-uuid-1');
    });

    it('should unarchive card', async () => {
      cardService.unarchive.mockResolvedValue(mockCard as any);

      const result = await controller.unarchive('ws-1', 'board-1', 'card-1', mockUser);

      expect(cardService.unarchive).toHaveBeenCalledWith('board-1', 'ws-1', 'card-1', 'user-uuid-1');
      expect(result.id).toBe('card-1');
    });
  });

  describe('assignees', () => {
    it('should add assignee', async () => {
      cardService.addAssignee.mockResolvedValue(undefined as any);

      await controller.addAssignee('ws-1', 'board-1', 'card-1', 'user-2');

      expect(cardService.addAssignee).toHaveBeenCalledWith('board-1', 'ws-1', 'card-1', 'user-2');
    });

    it('should remove assignee', async () => {
      cardService.removeAssignee.mockResolvedValue(undefined as any);

      await controller.removeAssignee('ws-1', 'board-1', 'card-1', 'user-2');

      expect(cardService.removeAssignee).toHaveBeenCalledWith('board-1', 'ws-1', 'card-1', 'user-2');
    });
  });

  describe('labels', () => {
    it('should add label to card', async () => {
      cardService.addLabel.mockResolvedValue(undefined as any);

      await controller.addLabel('ws-1', 'board-1', 'card-1', 'label-1');

      expect(cardService.addLabel).toHaveBeenCalledWith('board-1', 'ws-1', 'card-1', 'label-1');
    });

    it('should remove label from card', async () => {
      cardService.removeLabel.mockResolvedValue(undefined as any);

      await controller.removeLabel('ws-1', 'board-1', 'card-1', 'label-1');

      expect(cardService.removeLabel).toHaveBeenCalledWith('board-1', 'ws-1', 'card-1', 'label-1');
    });
  });
});
