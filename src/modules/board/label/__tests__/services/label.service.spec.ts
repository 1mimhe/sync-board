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
    labelRepo.create.mockResolvedValue(mockLabel as any);

    const result = await service.createLabel('board-uuid', 'ws-uuid', {
      name: 'Bug',
      color: '#f00',
    });
    expect(result).toEqual(mockLabel);
  });

  it('should throw EntityNotFoundException if board not found when creating board label', async () => {
    boardRepo.findById.mockResolvedValue(null);

    await expect(service.createLabel('b-99', 'ws-1', { name: 'Bug', color: '#f00' })).rejects.toThrow(EntityNotFoundException);
  });

  it('should create workspace label', async () => {
    const mockLabel = { id: 'lbl-ws', name: 'Global', color: '#00f' };
    labelRepo.create.mockResolvedValue(mockLabel as any);

    const result = await service.createWorkspaceLabel('ws-1', { name: 'Global', color: '#00f' });

    expect(labelRepo.create).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      boardId: null,
      name: 'Global',
      color: '#00f',
    });
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

    await expect(service.getLabelsForBoard('b-99', 'ws-1')).rejects.toThrow(EntityNotFoundException);
  });

  it('should get workspace labels', async () => {
    labelRepo.findWorkspaceLabels.mockResolvedValue([{ id: 'lbl-ws' }] as any);

    const result = await service.getWorkspaceLabels('ws-1');
    expect(result).toEqual([{ id: 'lbl-ws' }]);
  });

  it('should update label if found in workspace and board', async () => {
    boardRepo.findById.mockResolvedValue({ id: 'b-1' } as any);
    labelRepo.findById.mockResolvedValue({ id: 'lbl-1', workspaceId: 'ws-1', boardId: 'b-1' } as any);
    labelRepo.update.mockResolvedValue({ id: 'lbl-1', name: 'Updated' } as any);

    const result = await service.updateLabel('b-1', 'ws-1', 'lbl-1', { name: 'Updated', color: '#111' });

    expect(labelRepo.update).toHaveBeenCalledWith('lbl-1', { name: 'Updated', color: '#111' });
    expect(result.name).toBe('Updated');
  });

  it('should throw EntityNotFoundException if board not found during updateLabel', async () => {
    boardRepo.findById.mockResolvedValue(null);

    await expect(service.updateLabel('b-99', 'ws-1', 'lbl-1', { name: 'Updated' })).rejects.toThrow(EntityNotFoundException);
  });

  it('should throw EntityNotFoundException if label belongs to different workspace or board', async () => {
    boardRepo.findById.mockResolvedValue({ id: 'b-1' } as any);
    labelRepo.findById.mockResolvedValue({ id: 'lbl-1', workspaceId: 'ws-other', boardId: 'b-2' } as any);

    await expect(service.updateLabel('b-1', 'ws-1', 'lbl-1', { name: 'Updated' })).rejects.toThrow(EntityNotFoundException);
  });

  it('should delete label if found in workspace and board', async () => {
    boardRepo.findById.mockResolvedValue({ id: 'b-1' } as any);
    labelRepo.findById.mockResolvedValue({ id: 'lbl-1', workspaceId: 'ws-1', boardId: null } as any);
    labelRepo.delete.mockResolvedValue({ id: 'lbl-1' } as any);

    await service.deleteLabel('b-1', 'ws-1', 'lbl-1');

    expect(labelRepo.delete).toHaveBeenCalledWith('lbl-1');
  });

  it('should throw EntityNotFoundException if board not found during deleteLabel', async () => {
    boardRepo.findById.mockResolvedValue(null);

    await expect(service.deleteLabel('b-99', 'ws-1', 'lbl-1')).rejects.toThrow(EntityNotFoundException);
  });

  it('should throw EntityNotFoundException if label not found during deleteLabel', async () => {
    boardRepo.findById.mockResolvedValue({ id: 'b-1' } as any);
    labelRepo.findById.mockResolvedValue(null);

    await expect(service.deleteLabel('b-1', 'ws-1', 'lbl-99')).rejects.toThrow(EntityNotFoundException);
  });
});
