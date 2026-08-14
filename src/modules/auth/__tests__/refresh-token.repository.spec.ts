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
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
    expiresAt: new Date(Date.now() + 86400000),
    revokedAt: null,
    createdAt: new Date(),
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
        expiresAt: mockToken.expiresAt,
      });

      expect(result).toEqual(mockToken);
    });
  });

  describe('updateToken', () => {
    it('should update token hash and expiration in place', async () => {
      prismaMock.refreshToken.update.mockResolvedValue(mockToken);

      const result = await repository.updateToken('token-uuid-1', {
        tokenHash: 'new-token-hash',
        expiresAt: mockToken.expiresAt,
      });

      expect(result).toEqual(mockToken);
      expect(prismaMock.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'token-uuid-1' },
        data: {
          tokenHash: 'new-token-hash',
          expiresAt: mockToken.expiresAt,
          ipAddress: undefined,
          userAgent: undefined,
          revokedAt: null,
        },
      });
    });
  });
});
