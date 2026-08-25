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

  describe('findByBoardId', () => {
    it('should find recent board activities with default limit 50 and author profile details', async () => {
      const mockList = [{ id: 'act-1', user: { id: 'u-1', displayName: 'Jane', avatarUrl: null } }];
      prismaService.activity.findMany.mockResolvedValue(mockList);

      const result = await repository.findByBoardId('b-1');

      expect(prismaService.activity.findMany).toHaveBeenCalledWith({
        where: { boardId: 'b-1' },
        orderBy: { createdAt: 'desc' },
        take: 50,
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

    it('should respect custom limit in findByBoardId', async () => {
      prismaService.activity.findMany.mockResolvedValue([]);

      await repository.findByBoardId('b-1', 20);

      expect(prismaService.activity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20 }),
      );
    });
  });
});
