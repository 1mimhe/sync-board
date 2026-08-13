import { Injectable } from '@nestjs/common';
import { RefreshToken, User } from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma.service';

export type RefreshTokenWithUser = RefreshToken & { user: User };

/**
 * Repository handling database operations for RefreshToken entities.
 */
@Injectable()
export class RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new refresh token record in DB.
   */
  async create(data: {
    userId: string;
    tokenHash: string;
    familyId: string;
    ipAddress?: string;
    userAgent?: string;
    expiresAt: Date;
  }): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({
      data: {
        userId: data.userId,
        tokenHash: data.tokenHash,
        familyId: data.familyId,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        expiresAt: data.expiresAt,
      },
    });
  }

  /**
   * Find a refresh token by hash, including the associated user relation.
   */
  async findByTokenHashWithUser(
    tokenHash: string,
  ): Promise<RefreshTokenWithUser | null> {
    return this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
  }

  /**
   * Find a refresh token by hash without relation loading.
   */
  async findByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
  }

  /**
   * Revoke a single refresh token by its hash.
   */
  async revokeByTokenHash(tokenHash: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Revoke all refresh tokens in a given token family (reuse detection).
   */
  async revokeAllByFamilyId(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Revoke all refresh tokens for a given user (logout from all devices).
   */
  async revokeAllByUserId(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Perform token rotation in an atomic transaction:
   * Creates the new token, then marks the old token as revoked and links it
   * to the new token via `replacedBy` — all in a single database transaction.
   */
  async rotateToken(
    oldTokenId: string,
    newTokenData: {
      userId: string;
      tokenHash: string;
      familyId: string;
      ipAddress?: string;
      userAgent?: string;
      expiresAt: Date;
    },
  ): Promise<RefreshToken> {
    return this.prisma.$transaction(async (tx) => {
      const newToken = await tx.refreshToken.create({
        data: {
          userId: newTokenData.userId,
          tokenHash: newTokenData.tokenHash,
          familyId: newTokenData.familyId,
          ipAddress: newTokenData.ipAddress,
          userAgent: newTokenData.userAgent,
          expiresAt: newTokenData.expiresAt,
        },
      });

      await tx.refreshToken.update({
        where: { id: oldTokenId },
        data: { revokedAt: new Date(), replacedBy: newToken.id },
      });

      return newToken;
    });
  }

  /**
   * Purge expired or revoked refresh tokens older than a specified threshold date.
   */
  async deleteExpiredTokens(olderThanDate: Date): Promise<number> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: olderThanDate } },
          { revokedAt: { lt: olderThanDate } },
        ],
      },
    });
    return result.count;
  }
}
