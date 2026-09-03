import { Test, TestingModule } from '@nestjs/testing';
import { LabelRepository } from '../../repositories/label.repository';
import { PrismaService } from '../../../../../common/database/prisma.service';

describe('LabelRepository', () => {
  let repository: LabelRepository;
  let prismaService: any;

  beforeEach(async () => {
    prismaService = {
      label: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LabelRepository,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    repository = module.get<LabelRepository>(LabelRepository);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('create', () => {
    it('should create label record', async () => {
      const mockLabel = {
        id: 'lbl-1',
        name: 'Bug',
        color: '#ff0000',
        workspaceId: 'ws-1',
      };
      prismaService.label.create.mockResolvedValue(mockLabel);

      const result = await repository.create({
        name: 'Bug',
        color: '#ff0000',
        workspaceId: 'ws-1',
      });

      expect(prismaService.label.create).toHaveBeenCalledWith({
        data: { name: 'Bug', color: '#ff0000', workspaceId: 'ws-1' },
      });
      expect(result).toEqual(mockLabel);
    });
  });

  describe('findById', () => {
    it('should find label by id', async () => {
      const mockLabel = { id: 'lbl-1', name: 'Feature' };
      prismaService.label.findUnique.mockResolvedValue(mockLabel);

      const result = await repository.findById('lbl-1');

      expect(prismaService.label.findUnique).toHaveBeenCalledWith({
        where: { id: 'lbl-1' },
      });
      expect(result).toEqual(mockLabel);
    });
  });

  describe('findAvailableLabels', () => {
    it('should find all available workspace labels', async () => {
      const mockLabels = [
        { id: 'lbl-1', name: 'Shared' },
        { id: 'lbl-2', name: 'Board-only' },
      ];
      prismaService.label.findMany.mockResolvedValue(mockLabels);

      const result = await repository.findAvailableLabels('ws-1');

      expect(prismaService.label.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId: 'ws-1',
        },
        orderBy: { createdAt: 'asc' },
      });
      expect(result).toEqual(mockLabels);
    });
  });

  describe('findWorkspaceLabels', () => {
    it('should find only workspace-level labels', async () => {
      const mockLabels = [{ id: 'lbl-1' }];
      prismaService.label.findMany.mockResolvedValue(mockLabels);

      const result = await repository.findWorkspaceLabels('ws-1');

      expect(prismaService.label.findMany).toHaveBeenCalledWith({
        where: { workspaceId: 'ws-1' },
        orderBy: { createdAt: 'asc' },
      });
      expect(result).toEqual(mockLabels);
    });
  });

  describe('update and delete', () => {
    it('should update label details', async () => {
      const mockUpdated = { id: 'lbl-1', name: 'Critical Bug' };
      prismaService.label.update.mockResolvedValue(mockUpdated);

      const result = await repository.update('lbl-1', { name: 'Critical Bug' });

      expect(prismaService.label.update).toHaveBeenCalledWith({
        where: { id: 'lbl-1' },
        data: { name: 'Critical Bug' },
      });
      expect(result).toEqual(mockUpdated);
    });

    it('should delete label', async () => {
      const mockDeleted = { id: 'lbl-1' };
      prismaService.label.delete.mockResolvedValue(mockDeleted);

      const result = await repository.delete('lbl-1');

      expect(prismaService.label.delete).toHaveBeenCalledWith({
        where: { id: 'lbl-1' },
      });
      expect(result).toEqual(mockDeleted);
    });
  });
});
