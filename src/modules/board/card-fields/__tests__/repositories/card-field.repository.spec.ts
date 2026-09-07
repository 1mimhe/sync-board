import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { CardFieldRepository } from '../../repositories/card-field.repository';
import { PrismaService } from '../../../../../common/database/prisma.service';
import {
  EntityNotFoundException,
  BusinessRuleException,
} from '../../../../../common/exceptions/app.exception';

describe('CardFieldRepository', () => {
  let repository: CardFieldRepository;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      cardFieldDef: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      cardFieldValue: { upsert: jest.fn(), findMany: jest.fn() },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CardFieldRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    repository = module.get<CardFieldRepository>(CardFieldRepository);
  });

  it('should create definition', async () => {
    prisma.cardFieldDef.create.mockResolvedValue({ id: 'f-1' });
    await expect(
      repository.createDef({ workspaceId: 'ws-1' } as any),
    ).resolves.toEqual({ id: 'f-1' });
  });

  it('should map P2002 to FIELD_NAME_EXISTS on create', async () => {
    prisma.cardFieldDef.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('x', {
        code: 'P2002',
        clientVersion: 'x',
      }),
    );
    await expect(repository.createDef({} as any)).rejects.toBeInstanceOf(
      BusinessRuleException,
    );
  });

  it('should rethrow unknown create errors', async () => {
    prisma.cardFieldDef.create.mockRejectedValue(new Error('boom'));
    await expect(repository.createDef({} as any)).rejects.toThrow('boom');
  });

  it('should find, list, update and delete definitions', async () => {
    prisma.cardFieldDef.findUnique.mockResolvedValue({ id: 'f-1' });
    await expect(repository.findDefById('f-1')).resolves.toEqual({ id: 'f-1' });
    prisma.cardFieldDef.findMany.mockResolvedValue([{ id: 'f-1' }]);
    await expect(repository.listDefs('ws-1')).resolves.toHaveLength(1);
    prisma.cardFieldDef.update.mockResolvedValue({ id: 'f-1' });
    await expect(
      repository.updateDef('f-1', { name: 'X' } as any),
    ).resolves.toBeDefined();
    prisma.cardFieldDef.delete.mockResolvedValue({ id: 'f-1' });
    await repository.deleteDef('f-1');
    expect(prisma.cardFieldDef.delete).toHaveBeenCalledWith({
      where: { id: 'f-1' },
    });
  });

  it('should map P2025 to not-found on update', async () => {
    prisma.cardFieldDef.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('x', {
        code: 'P2025',
        clientVersion: 'x',
      }),
    );
    await expect(
      repository.updateDef('missing', {} as any),
    ).rejects.toBeInstanceOf(EntityNotFoundException);
  });

  it('should map P2002 to FIELD_NAME_EXISTS on update', async () => {
    prisma.cardFieldDef.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('x', {
        code: 'P2002',
        clientVersion: 'x',
      }),
    );
    await expect(repository.updateDef('f-1', {} as any)).rejects.toBeInstanceOf(
      BusinessRuleException,
    );
  });

  it('should map P2025 to not-found on delete', async () => {
    prisma.cardFieldDef.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('x', {
        code: 'P2025',
        clientVersion: 'x',
      }),
    );
    await expect(repository.deleteDef('missing')).rejects.toBeInstanceOf(
      EntityNotFoundException,
    );
  });

  it('should rethrow unknown update errors', async () => {
    prisma.cardFieldDef.update.mockRejectedValue(new Error('boom'));
    await expect(repository.updateDef('f-1', {} as any)).rejects.toThrow(
      'boom',
    );
  });

  it('should rethrow unknown delete errors', async () => {
    prisma.cardFieldDef.delete.mockRejectedValue(new Error('boom'));
    await expect(repository.deleteDef('f-1')).rejects.toThrow('boom');
  });

  it('should set value and list values', async () => {
    prisma.cardFieldValue.upsert.mockResolvedValue({ id: 'v-1' });
    await expect(repository.setValue('f-1', 'c-1', 'x')).resolves.toEqual({
      id: 'v-1',
    });
    prisma.cardFieldValue.findMany.mockResolvedValue([{ id: 'v-1' }]);
    await expect(repository.listValuesForCard('c-1')).resolves.toHaveLength(1);
  });
});
