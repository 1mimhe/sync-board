import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { RefreshTokenRepository } from '../repositories/refresh-token.repository';
import { PrismaService } from '../../../common/database/prisma.service';

describe('RefreshTokenRepository', () => {
  let repository: RefreshTokenRepository;
  let prismaMock: DeepMockProxy<PrismaService>;

  const mockToken = {
    id: 'token-uuid-1',
    userId: 'user-uuid-1',
    tokenHash: 'hashedtoken',
    familyId: 'family-uuid-1',
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
    expiresAt: new Date(Date.now() + 86400000),
    revokedAt: null,
    createdAt: new Date(),
    replacedBy: null,
  };

  beforeEach(async () => {
    prismaMock = mockDeep<PrismaService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokenRepository,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    repository = module.get<RefreshTokenRepository>(RefreshTokenRepository);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('create', () => {
    it('should create refresh token record', async () => {
      prismaMock.refreshToken.create.mockResolvedValue(mockToken);

      const result = await repository.create({
        userId: 'user-uuid-1',
        tokenHash: 'hashedtoken',
        familyId: 'family-uuid-1',
        expiresAt: mockToken.expiresAt,
      });

      expect(result).toEqual(mockToken);
    });
  });

  describe('revokeAllByFamilyId', () => {
    it('should revoke all tokens in family', async () => {
      prismaMock.refreshToken.updateMany.mockResolvedValue({ count: 2 });

      await repository.revokeAllByFamilyId('family-uuid-1');

      expect(prismaMock.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { familyId: 'family-uuid-1' },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });
});
