import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { CardViewService } from '../../services/card-view.service';
import { CardViewRepository } from '../../repositories/card-view.repository';
import { BoardRepository } from '../../../core/repositories/board.repository';
import {
  EntityNotFoundException,
  BusinessRuleException,
} from '../../../../../common/exceptions/app.exception';

describe('CardViewService', () => {
  let service: CardViewService;
  let viewRepo: DeepMockProxy<CardViewRepository>;
  let boardRepo: DeepMockProxy<BoardRepository>;

  beforeEach(async () => {
    viewRepo = mockDeep<CardViewRepository>();
    boardRepo = mockDeep<BoardRepository>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CardViewService,
        { provide: CardViewRepository, useValue: viewRepo },
        { provide: BoardRepository, useValue: boardRepo },
      ],
    }).compile();

    service = module.get<CardViewService>(CardViewService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return calendar page', async () => {
    boardRepo.findById.mockResolvedValue({ id: 'b-1' } as any);
    viewRepo.calendarPage.mockResolvedValue({
      items: [],
      pagination: { cursor: null, hasMore: false },
    });
    const result = await service.calendar('b-1', 'ws-1', {
      from: '2026-01-01',
      to: '2026-01-31',
    });
    expect(result.items).toEqual([]);
  });

  it('should throw when calendar range too large', async () => {
    boardRepo.findById.mockResolvedValue({ id: 'b-1' } as any);
    await expect(
      service.calendar('b-1', 'ws-1', {
        from: '2026-01-01',
        to: '2028-01-01',
      } as any),
    ).rejects.toBeInstanceOf(BusinessRuleException);
  });

  it('should throw when board missing on calendar', async () => {
    boardRepo.findById.mockResolvedValue(null);
    await expect(
      service.calendar('bad', 'ws-1', {
        from: '2026-01-01',
        to: '2026-01-02',
      } as any),
    ).rejects.toBeInstanceOf(EntityNotFoundException);
  });

  it('should return timeline page', async () => {
    boardRepo.findById.mockResolvedValue({ id: 'b-1' } as any);
    viewRepo.timelinePage.mockResolvedValue({
      items: [],
      pagination: { cursor: null, hasMore: false },
    });
    await expect(
      service.timeline('b-1', 'ws-1', {} as any),
    ).resolves.toBeDefined();
  });

  it('should return table page with filters', async () => {
    boardRepo.findById.mockResolvedValue({ id: 'b-1' } as any);
    viewRepo.tablePage.mockResolvedValue({
      items: [],
      pagination: { cursor: null, hasMore: false },
    });
    await expect(
      service.table('b-1', 'ws-1', { status: 'active' } as any),
    ).resolves.toBeDefined();
    expect(viewRepo.tablePage).toHaveBeenCalledWith(
      'b-1',
      { status: 'active', priority: undefined, assigneeId: undefined },
      undefined,
      20,
    );
  });
});
