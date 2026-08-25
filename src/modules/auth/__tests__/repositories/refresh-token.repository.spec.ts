import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { RefreshTokenRepository } from '../../repositories/refresh-token.repository';
import { PrismaService } from '../../../../common/database/prisma.service';

describe('RefreshTokenRepository', () => {
  let repository: RefreshTokenRepository;
  let prismaMock: DeepMockProxy<PrismaService>;

  const mockToken = {
    id: 'token-uuid-1',
    userId: 'user-uuid-1',
    tokenHash: 'hashedtoken',
    familyId: 'fam-1',
    replacedBy: null,
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
    expiresAt: new Date(Date.now() + 86400000),
    revokedAt: null,
    createdAt: new Date(),
  };

  const successorToken = {
    ...mockToken,
    id: 'token-uuid-2',
    tokenHash: 'new-hashedtoken',
  };

  beforeEach(async () => {
    prismaMock = mockDeep<PrismaService>();
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: PrismaService) => Promise<unknown>) =>
        callback(prismaMock),
    );

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
    it('should create refresh token record passing familyId through', async () => {
      prismaMock.refreshToken.create.mockResolvedValue(mockToken);

      const result = await repository.create({
        userId: 'user-uuid-1',
        tokenHash: 'hashedtoken',
        familyId: 'fam-1',
        expiresAt: mockToken.expiresAt,
      });

      expect(result).toEqual(mockToken);
      expect(prismaMock.refreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ familyId: 'fam-1' }),
      });
    });
  });

  describe('rotate', () => {
    it('should create successor in same family and revoke predecessor linked via replacedBy', async () => {
      prismaMock.refreshToken.create.mockResolvedValue(successorToken);
      prismaMock.refreshToken.update.mockResolvedValue({
        ...mockToken,
        revokedAt: new Date(),
        replacedBy: successorToken.id,
      });

      const expiresAt = new Date(Date.now() + 86400000);
      const result = await repository.rotate('token-uuid-1', {
        userId: 'user-uuid-1',
        familyId: 'fam-1',
        tokenHash: 'new-hashedtoken',
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
        expiresAt,
      });

      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(prismaMock.refreshToken.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-uuid-1',
          familyId: 'fam-1',
          tokenHash: 'new-hashedtoken',
          ipAddress: '127.0.0.1',
          userAgent: 'jest',
          expiresAt,
        },
      });
      expect(prismaMock.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'token-uuid-1' },
        data: {
          revokedAt: expect.any(Date),
          replacedBy: successorToken.id,
        },
      });
      expect(result).toEqual(successorToken);
    });
  });

  describe('revokeFamily', () => {
    it('should revoke all non-revoked tokens in the family and return the count', async () => {
      prismaMock.refreshToken.updateMany.mockResolvedValue({ count: 3 });

      const count = await repository.revokeFamily('fam-1');

      expect(prismaMock.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { familyId: 'fam-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(count).toBe(3);
    });
  });

  describe('findByTokenHashWithUser', () => {
    it('should find a token by hash including the user relation', async () => {
      const tokenWithUser = { ...mockToken, user: { id: 'user-uuid-1' } };
      prismaMock.refreshToken.findUnique.mockResolvedValue(
        tokenWithUser as never,
      );

      const result = await repository.findByTokenHashWithUser('hashedtoken');

      expect(prismaMock.refreshToken.findUnique).toHaveBeenCalledWith({
        where: { tokenHash: 'hashedtoken' },
        include: { user: true },
      });
      expect(result).toEqual(tokenWithUser);
    });
  });

  describe('findByTokenHash', () => {
    it('should find a token by hash without relations', async () => {
      prismaMock.refreshToken.findUnique.mockResolvedValue(mockToken);

      const result = await repository.findByTokenHash('hashedtoken');

      expect(prismaMock.refreshToken.findUnique).toHaveBeenCalledWith({
        where: { tokenHash: 'hashedtoken' },
      });
      expect(result).toEqual(mockToken);
    });
  });

  describe('revokeByTokenHash', () => {
    it('should revoke the active token with the given hash', async () => {
      prismaMock.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await repository.revokeByTokenHash('hashedtoken');

      expect(prismaMock.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash: 'hashedtoken', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('revokeAllByUserId', () => {
    it('should revoke all active tokens for the user', async () => {
      prismaMock.refreshToken.updateMany.mockResolvedValue({ count: 2 });

      await repository.revokeAllByUserId('user-uuid-1');

      expect(prismaMock.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-uuid-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('deleteExpiredTokens', () => {
    it('should delete tokens expired or revoked before the threshold date', async () => {
      const threshold = new Date('2026-01-01T00:00:00.000Z');
      prismaMock.refreshToken.deleteMany.mockResolvedValue({ count: 5 });

      const count = await repository.deleteExpiredTokens(threshold);

      expect(prismaMock.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { expiresAt: { lt: threshold } },
            { revokedAt: { lt: threshold } },
          ],
        },
      });
      expect(count).toBe(5);
    });
  });
});
