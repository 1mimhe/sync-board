import { LabelController } from '../../controllers/label.controller';
import { LabelService } from '../../services/label.service';

describe('LabelController', () => {
  let controller: LabelController;
  let labelService: jest.Mocked<LabelService>;

  const mockLabel = {
    id: 'label-1',
    name: 'Bug',
    color: '#ff0000',
  };

  beforeEach(() => {
    labelService = {
      createLabel: jest.fn(),
      getLabelsForBoard: jest.fn(),
      updateLabel: jest.fn(),
      deleteLabel: jest.fn(),
    } as unknown as jest.Mocked<LabelService>;

    controller = new LabelController(labelService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should create board label', async () => {
    labelService.createLabel.mockResolvedValue(mockLabel as any);

    const result = await controller.createLabel('ws-1', 'board-1', { name: 'Bug', color: '#ff0000' });

    expect(labelService.createLabel).toHaveBeenCalledWith('board-1', 'ws-1', { name: 'Bug', color: '#ff0000' });
    expect(result.name).toBe('Bug');
  });

  it('should get board labels', async () => {
    labelService.getLabelsForBoard.mockResolvedValue([mockLabel] as any);

    const result = await controller.getLabelsForBoard('ws-1', 'board-1');

    expect(labelService.getLabelsForBoard).toHaveBeenCalledWith('board-1', 'ws-1');
    expect(result).toHaveLength(1);
  });

  it('should update label', async () => {
    labelService.updateLabel.mockResolvedValue({ ...mockLabel, name: 'Critical' } as any);

    const result = await controller.updateLabel('ws-1', 'board-1', 'label-1', { name: 'Critical' });

    expect(labelService.updateLabel).toHaveBeenCalledWith('board-1', 'ws-1', 'label-1', { name: 'Critical' });
    expect(result.name).toBe('Critical');
  });

  it('should delete label', async () => {
    await controller.deleteLabel('ws-1', 'board-1', 'label-1');

    expect(labelService.deleteLabel).toHaveBeenCalledWith('board-1', 'ws-1', 'label-1');
  });
});
