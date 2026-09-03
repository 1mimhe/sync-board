import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { LabelService } from '../../services/label.service';
import { LabelRepository } from '../../repositories/label.repository';
import { BoardRepository } from '../../../board/repositories/board.repository';
import { EntityNotFoundException } from '../../../../../common/exceptions/app.exception';

describe('LabelService', () => {
  let service: LabelService;
  let labelRepo: DeepMockProxy<LabelRepository>;
  let boardRepo: DeepMockProxy<BoardRepository>;

  beforeEach(async () => {
    labelRepo = mockDeep<LabelRepository>();
    boardRepo = mockDeep<BoardRepository>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LabelService,
        { provide: LabelRepository, useValue: labelRepo },
        { provide: BoardRepository, useValue: boardRepo },
      ],
    }).compile();

    service = module.get<LabelService>(LabelService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create board label', async () => {
    boardRepo.findById.mockResolvedValue({ id: 'board-uuid' } as any);
    const mockLabel = { id: 'lbl-1', name: 'Bug', color: '#f00' };
    labelRepo.createWithCard.mockResolvedValue(mockLabel as any);

    const result = await service.createLabel(
      'board-uuid',
      'ws-uuid',
      { name: 'Bug', color: '#f00' },
      'user-1',
    );
    expect(result).toEqual(mockLabel);
    expect(labelRepo.createWithCard).toHaveBeenCalledWith(
      {
        workspaceId: 'ws-uuid',
        name: 'Bug',
        color: '#f00',
      },
      undefined,
    );
  });

  it('should throw EntityNotFoundException if board not found when creating board label', async () => {
    boardRepo.findById.mockResolvedValue(null);

    await expect(
      service.createLabel(
        'b-99',
        'ws-1',
        { name: 'Bug', color: '#f00' },
        'user-1',
      ),
    ).rejects.toThrow(EntityNotFoundException);
  });

  it('should create workspace label without boardId and with optional cardId', async () => {
    const mockLabel = { id: 'lbl-ws', name: 'Global', color: '#00f' };
    labelRepo.createWithCard.mockResolvedValue(mockLabel as any);

    const result = await service.createWorkspaceLabel(
      'ws-1',
      { name: 'Global', color: '#00f', cardId: 'card-1' },
      'user-1',
    );

    expect(labelRepo.createWithCard).toHaveBeenCalledWith(
      {
        workspaceId: 'ws-1',
        name: 'Global',
        color: '#00f',
      },
      'card-1',
    );
    expect(result).toEqual(mockLabel);
  });

  it('should get labels for board', async () => {
    boardRepo.findById.mockResolvedValue({ id: 'b-1' } as any);
    labelRepo.findAvailableLabels.mockResolvedValue([{ id: 'lbl-1' }] as any);

    const result = await service.getLabelsForBoard('b-1', 'ws-1');
    expect(result).toEqual([{ id: 'lbl-1' }]);
  });

  it('should throw EntityNotFoundException if board not found when getting board labels', async () => {
    boardRepo.findById.mockResolvedValue(null);

    await expect(service.getLabelsForBoard('b-99', 'ws-1')).rejects.toThrow(
      EntityNotFoundException,
    );
  });

  it('should get workspace labels', async () => {
    labelRepo.findWorkspaceLabels.mockResolvedValue([{ id: 'lbl-ws' }] as any);

    const result = await service.getWorkspaceLabels('ws-1');
    expect(result).toEqual([{ id: 'lbl-ws' }]);
  });

  it('should get cards for label in workspace', async () => {
    labelRepo.findById.mockResolvedValue({
      id: 'lbl-1',
      workspaceId: 'ws-1',
    } as any);
    labelRepo.findCardsForLabel.mockResolvedValue([
      { id: 'card-1', title: 'Task' },
    ] as any);

    const result = await service.getCardsForLabel('ws-1', 'lbl-1');
    expect(result).toEqual([{ id: 'card-1', title: 'Task' }]);
    expect(labelRepo.findCardsForLabel).toHaveBeenCalledWith('lbl-1', 'ws-1');
  });

  it('should throw EntityNotFoundException if label not found in getCardsForLabel', async () => {
    labelRepo.findById.mockResolvedValue(null);

    await expect(
      service.getCardsForLabel('ws-1', 'lbl-nonexistent'),
    ).rejects.toThrow(EntityNotFoundException);
  });

  it('should update board label if found in workspace and board', async () => {
    boardRepo.findById.mockResolvedValue({ id: 'b-1' } as any);
    labelRepo.findById.mockResolvedValue({
      id: 'lbl-1',
      workspaceId: 'ws-1',
    } as any);
    labelRepo.update.mockResolvedValue({ id: 'lbl-1', name: 'Updated' } as any);

    const result = await service.updateLabel(
      'b-1',
      'ws-1',
      'lbl-1',
      { name: 'Updated', color: '#111' },
      'user-1',
    );

    expect(labelRepo.update).toHaveBeenCalledWith('lbl-1', {
      name: 'Updated',
      color: '#111',
    });
    expect(result.name).toBe('Updated');
  });

  it('should throw EntityNotFoundException if board not found during updateLabel', async () => {
    boardRepo.findById.mockResolvedValue(null);

    await expect(
      service.updateLabel(
        'b-99',
        'ws-1',
        'lbl-1',
        { name: 'Updated' },
        'user-1',
      ),
    ).rejects.toThrow(EntityNotFoundException);
  });

  it('should throw EntityNotFoundException if label belongs to different workspace', async () => {
    boardRepo.findById.mockResolvedValue({ id: 'b-1' } as any);
    labelRepo.findById.mockResolvedValue({
      id: 'lbl-1',
      workspaceId: 'ws-other',
    } as any);

    await expect(
      service.updateLabel(
        'b-1',
        'ws-1',
        'lbl-1',
        { name: 'Updated' },
        'user-1',
      ),
    ).rejects.toThrow(EntityNotFoundException);
  });

  it('should update workspace label directly', async () => {
    labelRepo.findById.mockResolvedValue({
      id: 'lbl-1',
      workspaceId: 'ws-1',
    } as any);
    labelRepo.update.mockResolvedValue({ id: 'lbl-1', name: 'Renamed' } as any);

    const result = await service.updateWorkspaceLabel(
      'ws-1',
      'lbl-1',
      { name: 'Renamed' },
      'user-1',
    );

    expect(labelRepo.update).toHaveBeenCalledWith('lbl-1', {
      name: 'Renamed',
    });
    expect(result.name).toBe('Renamed');
  });

  it('should throw EntityNotFoundException when updating non-existent workspace label', async () => {
    labelRepo.findById.mockResolvedValue(null);

    await expect(
      service.updateWorkspaceLabel(
        'ws-1',
        'lbl-missing',
        { name: 'X' },
        'user-1',
      ),
    ).rejects.toThrow(EntityNotFoundException);
  });

  it('should delete board label', async () => {
    boardRepo.findById.mockResolvedValue({ id: 'b-1' } as any);
    labelRepo.findById.mockResolvedValue({
      id: 'lbl-1',
      workspaceId: 'ws-1',
    } as any);
    labelRepo.delete.mockResolvedValue({ id: 'lbl-1' } as any);

    await service.deleteLabel('b-1', 'ws-1', 'lbl-1', 'user-1');

    expect(labelRepo.delete).toHaveBeenCalledWith('lbl-1');
  });

  it('should delete workspace label directly', async () => {
    labelRepo.findById.mockResolvedValue({
      id: 'lbl-1',
      workspaceId: 'ws-1',
    } as any);
    labelRepo.delete.mockResolvedValue({ id: 'lbl-1' } as any);

    await service.deleteWorkspaceLabel('ws-1', 'lbl-1', 'user-1');

    expect(labelRepo.delete).toHaveBeenCalledWith('lbl-1');
  });

  it('should throw EntityNotFoundException if board not found during deleteLabel', async () => {
    boardRepo.findById.mockResolvedValue(null);

    await expect(
      service.deleteLabel('b-99', 'ws-1', 'lbl-1', 'user-1'),
    ).rejects.toThrow(EntityNotFoundException);
  });

  it('should throw EntityNotFoundException if label not found during deleteLabel', async () => {
    boardRepo.findById.mockResolvedValue({ id: 'b-1' } as any);
    labelRepo.findById.mockResolvedValue(null);

    await expect(
      service.deleteLabel('b-1', 'ws-1', 'lbl-99', 'user-1'),
    ).rejects.toThrow(EntityNotFoundException);
  });
});
