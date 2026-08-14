import { Test, TestingModule } from '@nestjs/testing';
import { LexorankService } from '../services/lexorank.service';

describe('LexorankService', () => {
  let service: LexorankService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LexorankService],
    }).compile();

    service = module.get<LexorankService>(LexorankService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return initial rank', () => {
    const rank = service.getInitialRank();
    expect(rank).toBeDefined();
    expect(typeof rank).toBe('string');
  });

  it('should return a rank between prev and next ranks', () => {
    const initial = service.getInitialRank();
    const next = service.getRankBetween(initial, null);
    const between = service.getRankBetween(initial, next);

    expect(between).toBeDefined();
    expect(between > initial).toBe(true);
    expect(between < next).toBe(true);
  });

  it('should return a rank before nextRank when prevRank is null', () => {
    const initial = service.getInitialRank();
    const prev = service.getRankBetween(null, initial);

    expect(prev).toBeDefined();
    expect(prev < initial).toBe(true);
  });
});
