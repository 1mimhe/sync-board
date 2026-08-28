import { ChecklistController } from '../../controllers/checklist.controller';
import { ChecklistService } from '../../services/checklist.service';
import type { JwtPayload } from '../../../auth/interfaces/jwt-payload.interface';

describe('ChecklistController', () => {
  let controller: ChecklistController;
  let checklistService: jest.Mocked<ChecklistService>;

  const mockUser: JwtPayload = {
    sub: 'user-uuid-1',
    email: 'user@test.com',
    jti: 'jti-1',
  };

  const mockChecklist = {
    id: 'checklist-uuid',
    cardId: 'card-1',
    title: 'Definition of Done',
    rank: '0|g0000:',
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [],
  };

  const mockItem = {
    id: 'item-uuid',
    checklistId: 'checklist-uuid',
    content: 'Code reviewed',
    isDone: false,
    rank: '0|h000zz:',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    checklistService = {
      createChecklist: jest.fn(),
      getChecklists: jest.fn(),
      renameChecklist: jest.fn(),
      deleteChecklist: jest.fn(),
      addItem: jest.fn(),
      updateItem: jest.fn(),
      removeItem: jest.fn(),
    } as unknown as jest.Mocked<ChecklistService>;

    controller = new ChecklistController(checklistService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('create', () => {
    it('should delegate to service with route params and map to response DTO', async () => {
      checklistService.createChecklist.mockResolvedValue(mockChecklist);

      const result = await controller.create(
        'ws-1',
        'board-1',
        'card-1',
        { title: 'Definition of Done' },
        mockUser,
      );

      expect(checklistService.createChecklist).toHaveBeenCalledWith(
        'ws-1',
        'board-1',
        'card-1',
        { title: 'Definition of Done' },
        'user-uuid-1',
      );
      expect(result.id).toBe('checklist-uuid');
      expect(result.items).toEqual([]);
    });
  });

  describe('list', () => {
    it('should return mapped checklists', async () => {
      checklistService.getChecklists.mockResolvedValue([mockChecklist]);

      const result = await controller.list('ws-1', 'board-1', 'card-1');

      expect(checklistService.getChecklists).toHaveBeenCalledWith(
        'ws-1',
        'board-1',
        'card-1',
      );
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Definition of Done');
    });
  });

  describe('rename', () => {
    it('should pass all params through and map the result', async () => {
      checklistService.renameChecklist.mockResolvedValue({
        ...mockChecklist,
        title: 'Renamed',
      });

      const result = await controller.rename(
        'ws-1',
        'board-1',
        'card-1',
        'checklist-uuid',
        { title: 'Renamed' },
        mockUser,
      );

      expect(checklistService.renameChecklist).toHaveBeenCalledWith(
        'ws-1',
        'board-1',
        'card-1',
        'checklist-uuid',
        { title: 'Renamed' },
        'user-uuid-1',
      );
      expect(result.title).toBe('Renamed');
    });
  });

  describe('delete', () => {
    it('should delegate deletion with user from token', async () => {
      await controller.delete(
        'ws-1',
        'board-1',
        'card-1',
        'checklist-uuid',
        mockUser,
      );

      expect(checklistService.deleteChecklist).toHaveBeenCalledWith(
        'ws-1',
        'board-1',
        'card-1',
        'checklist-uuid',
        'user-uuid-1',
      );
    });
  });

  describe('addItem', () => {
    it('should delegate item creation and map to item DTO', async () => {
      checklistService.addItem.mockResolvedValue(mockItem);

      const result = await controller.addItem(
        'ws-1',
        'board-1',
        'card-1',
        'checklist-uuid',
        { content: 'Code reviewed' },
        mockUser,
      );

      expect(checklistService.addItem).toHaveBeenCalledWith(
        'ws-1',
        'board-1',
        'card-1',
        'checklist-uuid',
        { content: 'Code reviewed' },
        'user-uuid-1',
      );
      expect(result.checklistId).toBe('checklist-uuid');
      expect(result.isDone).toBe(false);
    });
  });

  describe('updateItem', () => {
    it('should delegate item patch with all params', async () => {
      checklistService.updateItem.mockResolvedValue({
        ...mockItem,
        isDone: true,
      });

      const result = await controller.updateItem(
        'ws-1',
        'board-1',
        'card-1',
        'checklist-uuid',
        'item-uuid',
        { isDone: true },
        mockUser,
      );

      expect(checklistService.updateItem).toHaveBeenCalledWith(
        'ws-1',
        'board-1',
        'card-1',
        'checklist-uuid',
        'item-uuid',
        { isDone: true },
        'user-uuid-1',
      );
      expect(result.isDone).toBe(true);
    });
  });

  describe('removeItem', () => {
    it('should delegate item removal', async () => {
      await controller.removeItem(
        'ws-1',
        'board-1',
        'card-1',
        'checklist-uuid',
        'item-uuid',
        mockUser,
      );

      expect(checklistService.removeItem).toHaveBeenCalledWith(
        'ws-1',
        'board-1',
        'card-1',
        'checklist-uuid',
        'item-uuid',
        'user-uuid-1',
      );
    });
  });

  describe('route metadata (status codes + RBAC roles)', () => {
    const routeTable: {
      handler: keyof ChecklistController;
      status?: number;
    }[] = [
      { handler: 'create', status: 201 },
      { handler: 'list' },
      { handler: 'rename' },
      { handler: 'delete', status: 204 },
      { handler: 'addItem', status: 201 },
      { handler: 'updateItem' },
      { handler: 'removeItem', status: 204 },
    ];

    it.each(routeTable)(
      '$handler declares expected status code and member-level RBAC row',
      ({ handler, status }) => {
        const method = (
          ChecklistController.prototype as Record<string, unknown>
        )[handler as string];

        if (status) {
          // Nest 11 @HttpCode stores under '__httpCode__' on the handler function
          expect(Reflect.getMetadata('__httpCode__', method)).toBe(status);
        } else {
          expect(Reflect.getMetadata('__httpCode__', method)).toBeUndefined();
        }

        // All checklist routes allow owner/admin/member — viewer writes are rejected
        expect(Reflect.getMetadata('roles', method)).toEqual([
          'owner',
          'admin',
          'member',
        ]);
      },
    );
  });
});
