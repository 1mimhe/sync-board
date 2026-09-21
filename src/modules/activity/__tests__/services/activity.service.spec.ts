import { Test, TestingModule } from '@nestjs/testing';
import { ActivityService } from '../../services/activity.service';
import { ActivityRepository } from '../../repositories/activity.repository';
import { BoardService } from '../../../board/core/services/board.service';
import { AuthService } from '../../../auth/services/auth.service';
import { EntityNotFoundException } from '../../../../common/exceptions/app.exception';

describe('ActivityService', () => {
  let service: ActivityService;
  let repo: { getWorkspacePage: jest.Mock };
  let boardService: { assertActiveBoard: jest.Mock };
  let authService: { getProfile: jest.Mock };

  beforeEach(async () => {
    repo = { getWorkspacePage: jest.fn() };
    boardService = {
      assertActiveBoard: jest.fn().mockResolvedValue(undefined),
    };
    authService = { getProfile: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityService,
        { provide: ActivityRepository, useValue: repo },
        { provide: BoardService, useValue: boardService },
        { provide: AuthService, useValue: authService },
      ],
    }).compile();
    service = module.get(ActivityService);
  });

  it('passes filters without cursor/limit leakage and enriches actors', async () => {
    repo.getWorkspacePage.mockResolvedValue({
      items: [
        {
          actorId: 'u-1',
          id: 1n,
          workspaceId: 'ws-1',
          boardId: null,
          entityType: 'card',
          entityId: 'c-1',
          action: 'created',
          payload: {},
          metadata: null,
          createdAt: new Date(),
        },
      ],
      pagination: { cursor: null, hasMore: false },
    });
    authService.getProfile.mockResolvedValue({
      id: 'u-1',
      displayName: 'Jane',
      avatarUrl: null,
    });
    const result = await service.getWorkspaceFeed('ws-1', {
      entityType: 'card',
      limit: 10,
    } as never);
    expect(repo.getWorkspacePage).toHaveBeenCalledWith(
      'ws-1',
      { entityType: 'card' },
      undefined,
      10,
    );
    expect(result.items[0]).toMatchObject({
      actor: { id: 'u-1', displayName: 'Jane' },
    });
  });

  it('forces board filter on board feed', async () => {
    repo.getWorkspacePage.mockResolvedValue({
      items: [],
      pagination: { cursor: null, hasMore: false },
    });
    await service.getBoardFeed('ws-1', 'b-1', {});
    expect(boardService.assertActiveBoard).toHaveBeenCalledWith('b-1', 'ws-1');
    expect(repo.getWorkspacePage).toHaveBeenCalledWith(
      'ws-1',
      { boardId: 'b-1' },
      undefined,
      20,
    );
  });

  it('enriches feed with profiles and unknown-user fallback', async () => {
    repo.getWorkspacePage.mockResolvedValue({
      items: [{ actorId: 'u-1' }, { actorId: 'u-missing' }],
      pagination: { cursor: null, hasMore: false },
    });
    authService.getProfile
      .mockResolvedValueOnce({
        id: 'u-1',
        displayName: 'Jane',
        avatarUrl: null,
      })
      .mockRejectedValueOnce(new EntityNotFoundException('User', 'u-missing'));
    const result = await service.getWorkspaceFeed('ws-1', {});
    expect(result.items[0]).toMatchObject({
      actor: { id: 'u-1', displayName: 'Jane' },
    });
    expect(result.items[1]).toMatchObject({
      actor: { id: 'u-missing', displayName: 'Unknown user' },
    });
  });

  it('rethrows non-404 actor errors', async () => {
    repo.getWorkspacePage.mockResolvedValue({
      items: [{ actorId: 'u-1' }],
      pagination: {},
    });
    authService.getProfile.mockRejectedValue(new Error('db down'));
    await expect(service.getWorkspaceFeed('ws-1', {})).rejects.toThrow(
      'db down',
    );
  });
});
