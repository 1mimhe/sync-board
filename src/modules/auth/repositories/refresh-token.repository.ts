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
   * The familyId groups all tokens belonging to the same login session chain.
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
   * Rotate an active refresh token to a successor within the same family.
   * Atomically: creates the successor row, revokes the predecessor and links it
   * via replacedBy. Returns the newly created token row.
   */
  async rotate(
    previousTokenId: string,
    data: {
      userId: string;
      familyId: string;
      tokenHash: string;
      ipAddress?: string;
      userAgent?: string;
      expiresAt: Date;
    },
  ): Promise<RefreshToken> {
    return this.prisma.$transaction(async (tx) => {
      const successor = await tx.refreshToken.create({
        data: {
          userId: data.userId,
          familyId: data.familyId,
          tokenHash: data.tokenHash,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          expiresAt: data.expiresAt,
        },
      });

      await tx.refreshToken.update({
        where: { id: previousTokenId },
        data: { revokedAt: new Date(), replacedBy: successor.id },
      });

      return successor;
    });
  }

  /**
   * Reuse-detection response: revoke every non-revoked token in a family.
   * @returns number of tokens revoked
   */
  async revokeFamily(familyId: string): Promise<number> {
    const result = await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count;
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
