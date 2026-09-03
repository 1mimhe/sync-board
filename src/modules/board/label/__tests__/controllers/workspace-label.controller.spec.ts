import { WorkspaceLabelController } from '../../controllers/workspace-label.controller';
import { LabelService } from '../../services/label.service';

describe('WorkspaceLabelController', () => {
  let controller: WorkspaceLabelController;
  let labelService: jest.Mocked<LabelService>;

  const mockUser = { sub: 'user-1' } as any;
  const mockLabel = {
    id: 'label-1',
    workspaceId: 'ws-1',
    name: 'Bug',
    color: '#ff0000',
    createdAt: new Date(),
  };

  beforeEach(() => {
    labelService = {
      createWorkspaceLabel: jest.fn(),
      getWorkspaceLabels: jest.fn(),
      getCardsForLabel: jest.fn(),
      updateWorkspaceLabel: jest.fn(),
      deleteWorkspaceLabel: jest.fn(),
    } as unknown as jest.Mocked<LabelService>;

    controller = new WorkspaceLabelController(labelService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should create workspace label', async () => {
    labelService.createWorkspaceLabel.mockResolvedValue(mockLabel);

    const result = await controller.createWorkspaceLabel(
      'ws-1',
      { name: 'Bug', color: '#ff0000', cardId: 'card-1' },
      mockUser,
    );

    expect(labelService.createWorkspaceLabel).toHaveBeenCalledWith(
      'ws-1',
      { name: 'Bug', color: '#ff0000', cardId: 'card-1' },
      'user-1',
    );
    expect(result.id).toBe('label-1');
    expect(result.name).toBe('Bug');
  });

  it('should get all workspace labels', async () => {
    labelService.getWorkspaceLabels.mockResolvedValue([mockLabel]);

    const result = await controller.getWorkspaceLabels('ws-1');

    expect(labelService.getWorkspaceLabels).toHaveBeenCalledWith('ws-1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('label-1');
  });

  it('should get cards for label', async () => {
    const mockCard = {
      id: 'card-1',
      listId: 'list-1',
      title: 'Card 1',
      rank: '0|i00000:',
      description: null,
      dueDate: null,
      isComplete: false,
      coverImageUrl: null,
      createdBy: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      archivedAt: null,
      deletedAt: null,
      assignees: [],
      labels: [],
      attachments: [],
    };
    labelService.getCardsForLabel.mockResolvedValue([mockCard] as any);

    const result = await controller.getCardsForLabel('ws-1', 'label-1');

    expect(labelService.getCardsForLabel).toHaveBeenCalledWith(
      'ws-1',
      'label-1',
    );
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Card 1');
  });

  it('should update workspace label', async () => {
    labelService.updateWorkspaceLabel.mockResolvedValue({
      ...mockLabel,
      name: 'Critical',
    });

    const result = await controller.updateWorkspaceLabel(
      'ws-1',
      'label-1',
      { name: 'Critical' },
      mockUser,
    );

    expect(labelService.updateWorkspaceLabel).toHaveBeenCalledWith(
      'ws-1',
      'label-1',
      { name: 'Critical' },
      'user-1',
    );
    expect(result.name).toBe('Critical');
  });

  it('should delete workspace label', async () => {
    await controller.deleteWorkspaceLabel('ws-1', 'label-1', mockUser);

    expect(labelService.deleteWorkspaceLabel).toHaveBeenCalledWith(
      'ws-1',
      'label-1',
      'user-1',
    );
  });
});
