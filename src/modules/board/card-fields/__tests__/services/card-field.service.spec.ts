import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { BadRequestException } from '@nestjs/common';
import { CardFieldService } from '../../services/card-field.service';
import { CardFieldRepository } from '../../repositories/card-field.repository';
import { CardRepository } from '../../../card/repositories/card.repository';
import { BoardRepository } from '../../../core/repositories/board.repository';
import { WorkspaceService } from '../../../../workspace/services/workspace.service';
import { EntityNotFoundException } from '../../../../../common/exceptions/app.exception';

describe('CardFieldService', () => {
  let service: CardFieldService;
  let fieldRepo: DeepMockProxy<CardFieldRepository>;
  let cardRepo: DeepMockProxy<CardRepository>;
  let boardRepo: DeepMockProxy<BoardRepository>;
  let workspaceService: DeepMockProxy<WorkspaceService>;

  beforeEach(async () => {
    fieldRepo = mockDeep<CardFieldRepository>();
    cardRepo = mockDeep<CardRepository>();
    boardRepo = mockDeep<BoardRepository>();
    workspaceService = mockDeep<WorkspaceService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CardFieldService,
        { provide: CardFieldRepository, useValue: fieldRepo },
        { provide: CardRepository, useValue: cardRepo },
        { provide: BoardRepository, useValue: boardRepo },
        { provide: WorkspaceService, useValue: workspaceService },
      ],
    }).compile();

    service = module.get<CardFieldService>(CardFieldService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create field definition', async () => {
    const mock = { id: 'f-1' };
    fieldRepo.createDef.mockResolvedValue(mock as any);
    const result = await service.createDef(
      'ws-1',
      { name: 'Points', fieldType: 'number' } as any,
      'u-1',
    );
    expect(result).toEqual(mock);
  });

  it('should list definitions', async () => {
    fieldRepo.listDefs.mockResolvedValue([{ id: 'f-1' }] as any);
    await expect(service.listDefs('ws-1')).resolves.toHaveLength(1);
  });

  it('should update definition when in workspace', async () => {
    fieldRepo.findDefById.mockResolvedValue({
      id: 'f-1',
      workspaceId: 'ws-1',
    } as any);
    fieldRepo.updateDef.mockResolvedValue({ id: 'f-1' } as any);
    await expect(
      service.updateDef('ws-1', 'f-1', { name: 'X' } as any),
    ).resolves.toBeDefined();
  });

  it('should throw when updating missing definition', async () => {
    fieldRepo.findDefById.mockResolvedValue(null);
    await expect(
      service.updateDef('ws-1', 'missing', {} as any),
    ).rejects.toBeInstanceOf(EntityNotFoundException);
  });

  it('should throw when updating definition from another workspace', async () => {
    fieldRepo.findDefById.mockResolvedValue({
      id: 'f-1',
      workspaceId: 'other',
    } as any);
    await expect(
      service.updateDef('ws-1', 'f-1', {} as any),
    ).rejects.toBeInstanceOf(EntityNotFoundException);
  });

  it('should delete definition when in workspace', async () => {
    fieldRepo.findDefById.mockResolvedValue({
      id: 'f-1',
      workspaceId: 'ws-1',
    } as any);
    await service.deleteDef('ws-1', 'f-1');
    expect(fieldRepo.deleteDef).toHaveBeenCalledWith('f-1');
  });

  it('should throw when deleting missing definition', async () => {
    fieldRepo.findDefById.mockResolvedValue(null);
    await expect(service.deleteDef('ws-1', 'missing')).rejects.toBeInstanceOf(
      EntityNotFoundException,
    );
  });

  it('should set text field value', async () => {
    boardRepo.findById.mockResolvedValue({ id: 'b-1' } as any);
    fieldRepo.findDefById.mockResolvedValue({
      id: 'f-1',
      workspaceId: 'ws-1',
      fieldType: 'text',
      options: null,
    } as any);
    cardRepo.findActiveById.mockResolvedValue({ id: 'c-1' } as any);
    fieldRepo.setValue.mockResolvedValue({ id: 'v-1' } as any);
    const result = await service.setValue('b-1', 'ws-1', 'c-1', 'f-1', {
      value: 'hello',
    });
    expect(result).toEqual({ id: 'v-1' });
  });

  it('should throw when board missing on setValue', async () => {
    boardRepo.findById.mockResolvedValue(null);
    await expect(
      service.setValue('bad', 'ws-1', 'c-1', 'f-1', { value: 'x' }),
    ).rejects.toBeInstanceOf(EntityNotFoundException);
  });

  it('should throw when field missing on setValue', async () => {
    boardRepo.findById.mockResolvedValue({ id: 'b-1' } as any);
    fieldRepo.findDefById.mockResolvedValue(null);
    await expect(
      service.setValue('b-1', 'ws-1', 'c-1', 'f-x', { value: 'x' }),
    ).rejects.toBeInstanceOf(EntityNotFoundException);
  });

  it('should throw when card missing on setValue', async () => {
    boardRepo.findById.mockResolvedValue({ id: 'b-1' } as any);
    fieldRepo.findDefById.mockResolvedValue({
      id: 'f-1',
      workspaceId: 'ws-1',
      fieldType: 'text',
      options: null,
    } as any);
    cardRepo.findActiveById.mockResolvedValue(null);
    await expect(
      service.setValue('b-1', 'ws-1', 'c-x', 'f-1', { value: 'x' }),
    ).rejects.toBeInstanceOf(EntityNotFoundException);
  });

  it('should throw BadRequest for invalid field value', async () => {
    boardRepo.findById.mockResolvedValue({ id: 'b-1' } as any);
    fieldRepo.findDefById.mockResolvedValue({
      id: 'f-1',
      workspaceId: 'ws-1',
      fieldType: 'number',
      options: null,
    } as any);
    cardRepo.findActiveById.mockResolvedValue({ id: 'c-1' } as any);
    await expect(
      service.setValue('b-1', 'ws-1', 'c-1', 'f-1', { value: 'not-a-number' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should throw when user field references non-member', async () => {
    boardRepo.findById.mockResolvedValue({ id: 'b-1' } as any);
    fieldRepo.findDefById.mockResolvedValue({
      id: 'f-1',
      workspaceId: 'ws-1',
      fieldType: 'user',
      options: null,
    } as any);
    cardRepo.findActiveById.mockResolvedValue({ id: 'c-1' } as any);
    workspaceService.isUserMember.mockResolvedValue(false);
    await expect(
      service.setValue('b-1', 'ws-1', 'c-1', 'f-1', {
        value: '123e4567-e89b-42d3-a456-426614174000',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should set user field value for members', async () => {
    boardRepo.findById.mockResolvedValue({ id: 'b-1' } as any);
    fieldRepo.findDefById.mockResolvedValue({
      id: 'f-1',
      workspaceId: 'ws-1',
      fieldType: 'user',
      options: null,
    } as any);
    cardRepo.findActiveById.mockResolvedValue({ id: 'c-1' } as any);
    workspaceService.isUserMember.mockResolvedValue(true);
    fieldRepo.setValue.mockResolvedValue({ id: 'v-1' } as any);
    await expect(
      service.setValue('b-1', 'ws-1', 'c-1', 'f-1', {
        value: '123e4567-e89b-42d3-a456-426614174000',
      }),
    ).resolves.toEqual({ id: 'v-1' });
  });

  it('should list values for card', async () => {
    boardRepo.findById.mockResolvedValue({ id: 'b-1' } as any);
    cardRepo.findActiveById.mockResolvedValue({ id: 'c-1' } as any);
    fieldRepo.listValuesForCard.mockResolvedValue([{ id: 'v-1' }] as any);
    await expect(
      service.listValues('b-1', 'ws-1', 'c-1'),
    ).resolves.toHaveLength(1);
  });

  it('should throw when listing values for missing card', async () => {
    boardRepo.findById.mockResolvedValue({ id: 'b-1' } as any);
    cardRepo.findActiveById.mockResolvedValue(null);
    await expect(
      service.listValues('b-1', 'ws-1', 'c-x'),
    ).rejects.toBeInstanceOf(EntityNotFoundException);
  });
});
