import { Test, TestingModule } from '@nestjs/testing';
import { LexorankService } from '../../services/lexorank.service';
import { BusinessRuleException } from '../../../../../common/exceptions/app.exception';

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

  it('should return initial rank when both prevRank and nextRank are omitted or null', () => {
    const rank = service.getRankBetween(null, null);
    expect(rank).toBe(service.getInitialRank());
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

  it('should throw BusinessRuleException when rank string is invalid or malformed', () => {
    expect(() =>
      service.getRankBetween('invalid-rank-string', 'another-invalid'),
    ).toThrow(BusinessRuleException);
  });

  it('should rethrow BusinessRuleException unchanged instead of wrapping it', () => {
    const businessError = new BusinessRuleException(
      'INVALID_RANK',
      'pre-existing business rule failure',
    );
    jest.spyOn(service, 'getInitialRank').mockImplementation(() => {
      throw businessError;
    });

    expect(() => service.getRankBetween(null, null)).toThrow(businessError);
  });
});
