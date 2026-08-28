import { Test, TestingModule } from '@nestjs/testing';
import { ActivityRepository } from '../../repositories/activity.repository';
import { PrismaService } from '../../../../common/database/prisma.service';
import { ActionType, EntityType } from '@prisma/client';

describe('ActivityRepository', () => {
  let repository: ActivityRepository;
  let prismaService: any;

  beforeEach(async () => {
    prismaService = {
      activity: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityRepository,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    repository = module.get<ActivityRepository>(ActivityRepository);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('create', () => {
    it('should create an activity entry', async () => {
      const mockResult = {
        id: 'act-1',
        boardId: 'b-1',
        userId: 'u-1',
        action: ActionType.created,
        entityType: EntityType.card,
      };
      prismaService.activity.create.mockResolvedValue(mockResult);

      const result = await repository.create({
        boardId: 'b-1',
        userId: 'u-1',
        action: ActionType.created,
        entityType: EntityType.card,
        entityId: 'c-1',
        entityTitle: 'New Card',
      });

      expect(prismaService.activity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          boardId: 'b-1',
          userId: 'u-1',
          action: ActionType.created,
          entityType: EntityType.card,
          entityId: 'c-1',
          entityTitle: 'New Card',
        }),
      });
      expect(result).toEqual(mockResult);
    });
  });

  describe('findByBoardIdPage', () => {
    it('should find a page of board activities with author profile details', async () => {
      const mockList = [
        {
          id: 'act-1',
          user: { id: 'u-1', displayName: 'Jane', avatarUrl: null },
        },
      ];
      prismaService.activity.findMany.mockResolvedValue(mockList);

      const result = await repository.findByBoardIdPage('b-1', 'prev-1', 20);

      expect(prismaService.activity.findMany).toHaveBeenCalledWith({
        where: { boardId: 'b-1' },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 21,
        cursor: { id: 'prev-1' },
        skip: 1,
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      });
      expect(result).toEqual(mockList);
    });

    it('should omit cursor when not provided', async () => {
      prismaService.activity.findMany.mockResolvedValue([]);

      await repository.findByBoardIdPage('b-1', undefined, 20);

      expect(prismaService.activity.findMany).toHaveBeenCalledWith(
        expect.not.objectContaining({ cursor: expect.anything() }),
      );
    });
  });
});
