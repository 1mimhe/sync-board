import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { CardTimeService } from '../../services/card-time.service';
import { CardTimeRepository } from '../../repositories/card-time.repository';
import { CardRepository } from '../../../card/repositories/card.repository';
import { BoardRepository } from '../../../core/repositories/board.repository';
import { EntityNotFoundException } from '../../../../../common/exceptions/app.exception';

describe('CardTimeService', () => {
  let service: CardTimeService;
  let timeRepo: DeepMockProxy<CardTimeRepository>;
  let cardRepo: DeepMockProxy<CardRepository>;
  let boardRepo: DeepMockProxy<BoardRepository>;

  beforeEach(async () => {
    timeRepo = mockDeep<CardTimeRepository>();
    cardRepo = mockDeep<CardRepository>();
    boardRepo = mockDeep<BoardRepository>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CardTimeService,
        { provide: CardTimeRepository, useValue: timeRepo },
        { provide: CardRepository, useValue: cardRepo },
        { provide: BoardRepository, useValue: boardRepo },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<CardTimeService>(CardTimeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should set estimate', async () => {
    boardRepo.findById.mockResolvedValue({ id: 'b-1' } as any);
    cardRepo.findActiveById.mockResolvedValue({ id: 'c-1' } as any);
    cardRepo.update.mockResolvedValue({
      id: 'c-1',
      estimateMinutes: 60,
    } as any);
    const result = await service.setEstimate(
      'b-1',
      'ws-1',
      'c-1',
      { estimateMinutes: 60 },
      'u-1',
    );
    expect(result).toEqual({ id: 'c-1', estimateMinutes: 60 });
  });

  it('should throw when board missing on setEstimate', async () => {
    boardRepo.findById.mockResolvedValue(null);
    await expect(
      service.setEstimate('bad', 'ws-1', 'c-1', { estimateMinutes: 60 }, 'u-1'),
    ).rejects.toBeInstanceOf(EntityNotFoundException);
  });

  it('should throw when card missing on setEstimate', async () => {
    boardRepo.findById.mockResolvedValue({ id: 'b-1' } as any);
    cardRepo.findActiveById.mockResolvedValue(null);
    await expect(
      service.setEstimate('b-1', 'ws-1', 'c-x', { estimateMinutes: 60 }, 'u-1'),
    ).rejects.toBeInstanceOf(EntityNotFoundException);
  });

  it('should log time and emit event', async () => {
    boardRepo.findById.mockResolvedValue({ id: 'b-1' } as any);
    cardRepo.findActiveById
      .mockResolvedValueOnce({ id: 'c-1' } as any)
      .mockResolvedValueOnce({ id: 'c-1', loggedMinutes: 30 } as any);
    timeRepo.addEntry.mockResolvedValue({ id: 'e-1' } as any);
    const result = await service.logTime(
      'b-1',
      'ws-1',
      'c-1',
      { minutes: 30 },
      'u-1',
    );
    expect(result).toEqual({ id: 'c-1', loggedMinutes: 30 });
  });

  it('should throw when card missing on logTime', async () => {
    boardRepo.findById.mockResolvedValue({ id: 'b-1' } as any);
    cardRepo.findActiveById.mockResolvedValue(null);
    await expect(
      service.logTime('b-1', 'ws-1', 'c-x', { minutes: 30 }, 'u-1'),
    ).rejects.toBeInstanceOf(EntityNotFoundException);
  });

  it('should throw when card vanishes after time entry write', async () => {
    boardRepo.findById.mockResolvedValue({ id: 'b-1' } as any);
    cardRepo.findActiveById
      .mockResolvedValueOnce({ id: 'c-1' } as any)
      .mockResolvedValueOnce(null);
    timeRepo.addEntry.mockResolvedValue({ id: 'e-1' } as any);
    await expect(
      service.logTime('b-1', 'ws-1', 'c-1', { minutes: 30 }, 'u-1'),
    ).rejects.toBeInstanceOf(EntityNotFoundException);
  });

  it('should get tracking summary', async () => {
    boardRepo.findById.mockResolvedValue({ id: 'b-1' } as any);
    cardRepo.findActiveById.mockResolvedValue({
      id: 'c-1',
      loggedMinutes: 20,
      estimateMinutes: 60,
    } as any);
    timeRepo.listForCard.mockResolvedValue({
      items: [],
      pagination: { cursor: null, hasMore: false },
    });
    const result = await service.getTracking('b-1', 'ws-1', 'c-1');
    expect(result).toEqual({
      estimate: 60,
      logged: 20,
      remaining: 40,
      entries: { items: [], pagination: { cursor: null, hasMore: false } },
    });
  });

  it('should handle null estimate in tracking', async () => {
    boardRepo.findById.mockResolvedValue({ id: 'b-1' } as any);
    cardRepo.findActiveById.mockResolvedValue({
      id: 'c-1',
      loggedMinutes: 5,
      estimateMinutes: null,
    } as any);
    timeRepo.listForCard.mockResolvedValue({
      items: [],
      pagination: { cursor: null, hasMore: false },
    });
    const result = await service.getTracking('b-1', 'ws-1', 'c-1');
    expect(result.estimate).toBeNull();
    expect(result.remaining).toBe(0);
  });

  it('should throw when card missing on getTracking', async () => {
    boardRepo.findById.mockResolvedValue({ id: 'b-1' } as any);
    cardRepo.findActiveById.mockResolvedValue(null);
    await expect(
      service.getTracking('b-1', 'ws-1', 'c-x'),
    ).rejects.toBeInstanceOf(EntityNotFoundException);
  });
});
