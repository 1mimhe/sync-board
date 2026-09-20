import { Test, TestingModule } from '@nestjs/testing';
import { ActivityService } from '../../services/activity.service';
import { ActivityRepository } from '../../repositories/activity.repository';
import { BoardService } from '../../../board/core/services/board.service';
import { AuthService } from '../../../auth/services/auth.service';
import { EntityNotFoundException } from '../../../../common/exceptions/app.exception';

describe('ActivityService', () => {
  let service: ActivityService;
  let repo: { getWorkspacePage: jest.Mock; getLegacyBoardPage: jest.Mock };
  let boardService: { assertActiveBoard: jest.Mock };
  let authService: { getProfile: jest.Mock };

  beforeEach(async () => {
    repo = { getWorkspacePage: jest.fn(), getLegacyBoardPage: jest.fn() };
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

  it('passes filters without cursor/limit leakage', async () => {
    repo.getWorkspacePage.mockResolvedValue({
      items: [],
      pagination: { cursor: null, hasMore: false },
    });
    await service.getWorkspaceFeed('ws-1', {
      entityType: 'card',
      limit: 10,
    } as never);
    expect(repo.getWorkspacePage).toHaveBeenCalledWith(
      'ws-1',
      { entityType: 'card' },
      undefined,
      10,
    );
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

  it('enriches legacy feed with profiles and unknown-user fallback', async () => {
    repo.getLegacyBoardPage.mockResolvedValue({
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
    const result = await service.getLegacyBoardFeed('ws-1', 'b-1', {});
    expect(result.items[0]).toMatchObject({
      actor: { id: 'u-1', displayName: 'Jane' },
    });
    expect(result.items[1]).toMatchObject({
      actor: { id: 'u-missing', displayName: 'Unknown user' },
    });
  });

  it('rethrows non-404 actor errors', async () => {
    repo.getLegacyBoardPage.mockResolvedValue({
      items: [{ actorId: 'u-1' }],
      pagination: {},
    });
    authService.getProfile.mockRejectedValue(new Error('db down'));
    await expect(service.getLegacyBoardFeed('ws-1', 'b-1', {})).rejects.toThrow(
      'db down',
    );
  });
});
