import { Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../../../common/database/prisma.service';
import { AppException } from '../../../common/exceptions/app.exception';

/**
 * Repository handling database operations for User entities.
 */
@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new user with email, password hash, and display name.
   * @throws AppException EMAIL_ALREADY_EXISTS on duplicate email
   */
  async createUser(data: {
    email: string;
    passwordHash: string;
    displayName: string;
  }): Promise<User> {
    try {
      return await this.prisma.user.create({
        data: {
          email: data.email,
          passwordHash: data.passwordHash,
          displayName: data.displayName,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new AppException(
          'EMAIL_ALREADY_EXISTS',
          'This email is already registered',
          409,
        );
      }
      throw error;
    }
  }

  /**
   * Find a user by their unique email address.
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * Find a user by their UUID primary key.
   */
  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  /**
   * Find a user by UUID, omitting the password hash — safe for API responses.
   */
  async findByIdPublic(id: string): Promise<Omit<User, 'passwordHash'> | null> {
    return this.prisma.user.findUnique({
      where: { id },
      omit: { passwordHash: true },
    });
  }

  /**
   * Find a user by their Google OAuth ID.
   */
  async findByGoogleId(googleId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { googleId },
    });
  }

  /**
   * Update the user's last login timestamp to current date/time.
   */
  async updateLastLogin(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }

  /**
   * Mark a user's email address as verified.
   */
  async setEmailVerified(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isEmailVerified: true },
    });
  }

  /**
   * Update user profile attributes (displayName and/or avatarUrl).
   * The password hash is omitted so the returned record is safe for API responses.
   */
  async updateProfile(
    userId: string,
    data: Partial<Pick<User, 'displayName' | 'avatarUrl'>>,
  ): Promise<Omit<User, 'passwordHash'>> {
    return this.prisma.user.update({
      where: { id: userId },
      data,
      omit: { passwordHash: true },
    });
  }

  /**
   * Update a user's password hash.
   */
  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  /**
   * Find lightweight user summary by email (excluding passwordHash).
   */
  async findUserSummaryByEmail(
    email: string,
  ): Promise<Pick<User, 'id' | 'email' | 'displayName' | 'avatarUrl'> | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
      },
    });
  }

  /**
   * Update user record on Google login (updating metadata or linking Google ID).
   */
  async updateGoogleLogin(
    userId: string,
    data: Prisma.UserUpdateInput,
  ): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }

  /**
   * Create a new user record for Google OAuth registration.
   */
  async createGoogleUser(data: {
    email: string;
    googleId: string;
    displayName: string;
    avatarUrl?: string;
  }): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: data.email,
        googleId: data.googleId,
        displayName: data.displayName,
        avatarUrl: data.avatarUrl,
        isEmailVerified: true,
        lastLoginAt: new Date(),
      },
    });
  }
}
