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
   * Create a new refresh token record in DB for an active session.
   */
  async create(data: {
    userId: string;
    tokenHash: string;
    ipAddress?: string;
    userAgent?: string;
    expiresAt: Date;
  }): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({
      data: {
        userId: data.userId,
        tokenHash: data.tokenHash,
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
   * Update / rotate an active refresh token in-place on refresh.
   */
  async updateToken(
    tokenId: string,
    data: {
      tokenHash: string;
      expiresAt: Date;
      ipAddress?: string;
      userAgent?: string;
    },
  ): Promise<RefreshToken> {
    return this.prisma.refreshToken.update({
      where: { id: tokenId },
      data: {
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        revokedAt: null,
      },
    });
  }

  /**
   * Revoke a single refresh token by its hash (single device logout).
   */
  async revokeByTokenHash(tokenHash: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
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
