import { ListController } from '../../controllers/list.controller';
import { ListService } from '../../services/list.service';
import type { JwtPayload } from '../../../auth/interfaces/jwt-payload.interface';

describe('ListController', () => {
  let controller: ListController;
  let listService: jest.Mocked<ListService>;

  const mockUser: JwtPayload = {
    sub: 'user-uuid-1',
    email: 'user@test.com',
    jti: 'jti-1',
  };

  const mockList = {
    id: 'list-1',
    boardId: 'board-1',
    title: 'To Do',
    rank: '0|hzzzzz:',
    createdAt: new Date(),
    updatedAt: new Date(),
    archivedAt: null,
  };

  beforeEach(() => {
    listService = {
      create: jest.fn(),
      update: jest.fn(),
      move: jest.fn(),
      archive: jest.fn(),
      unarchive: jest.fn(),
    } as unknown as jest.Mocked<ListService>;

    controller = new ListController(listService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('create', () => {
    it('should create list and map response', async () => {
      listService.create.mockResolvedValue(mockList as any);

      const result = await controller.create('ws-1', 'board-1', { title: 'To Do' }, mockUser);

      expect(listService.create).toHaveBeenCalledWith('board-1', 'ws-1', { title: 'To Do' }, 'user-uuid-1');
      expect(result.id).toBe('list-1');
      expect(result.title).toBe('To Do');
    });
  });

  describe('update', () => {
    it('should update list title', async () => {
      listService.update.mockResolvedValue({ ...mockList, title: 'In Progress' } as any);

      const result = await controller.update('ws-1', 'board-1', 'list-1', { title: 'In Progress' }, mockUser);

      expect(listService.update).toHaveBeenCalledWith('board-1', 'ws-1', 'list-1', { title: 'In Progress' }, 'user-uuid-1');
      expect(result.title).toBe('In Progress');
    });
  });

  describe('move', () => {
    it('should reorder list via LexoRank', async () => {
      listService.move.mockResolvedValue({ ...mockList, rank: '0|i:' } as any);

      const result = await controller.move('ws-1', 'board-1', 'list-1', { prevRank: '0|h:' }, mockUser);

      expect(listService.move).toHaveBeenCalledWith('board-1', 'ws-1', 'list-1', { prevRank: '0|h:' }, 'user-uuid-1');
      expect(result.rank).toBe('0|i:');
    });
  });

  describe('archive and unarchive', () => {
    it('should archive list', async () => {
      listService.archive.mockResolvedValue(undefined as any);

      await controller.archive('ws-1', 'board-1', 'list-1', mockUser);

      expect(listService.archive).toHaveBeenCalledWith('board-1', 'ws-1', 'list-1', 'user-uuid-1');
    });

    it('should unarchive list and return mapped DTO', async () => {
      listService.unarchive.mockResolvedValue(mockList as any);

      const result = await controller.unarchive('ws-1', 'board-1', 'list-1', mockUser);

      expect(listService.unarchive).toHaveBeenCalledWith('board-1', 'ws-1', 'list-1', 'user-uuid-1');
      expect(result.id).toBe('list-1');
    });
  });
});
