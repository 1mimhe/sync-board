import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { Prisma } from '@prisma/client';
import { UserRepository } from '../repositories/user.repository';
import { PrismaService } from '../../../common/database/prisma.service';
import { AppException } from '../../../common/exceptions/app.exception';

describe('UserRepository', () => {
  let repository: UserRepository;
  let prismaMock: DeepMockProxy<PrismaService>;

  const mockUser = {
    id: 'user-uuid-1',
    email: 'user@example.com',
    passwordHash: '$2b$12$hashedpassword',
    displayName: 'John Doe',
    avatarUrl: null,
    googleId: null,
    isEmailVerified: false,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prismaMock = mockDeep<PrismaService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserRepository,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    repository = module.get<UserRepository>(UserRepository);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('createUser', () => {
    it('should create a new user successfully', async () => {
      prismaMock.user.create.mockResolvedValue(mockUser);

      const result = await repository.createUser({
        email: 'user@example.com',
        passwordHash: 'hash',
        displayName: 'John Doe',
      });

      expect(result).toEqual(mockUser);
    });

    it('should throw AppException EMAIL_ALREADY_EXISTS on P2002 error', async () => {
      const p2002Error = new Prisma.PrismaClientKnownRequestError('P2002', {
        code: 'P2002',
        clientVersion: '7.9.1',
      });
      prismaMock.user.create.mockRejectedValue(p2002Error);

      await expect(
        repository.createUser({
          email: 'user@example.com',
          passwordHash: 'hash',
          displayName: 'John Doe',
        }),
      ).rejects.toThrow(AppException);
    });
  });

  describe('findByEmail', () => {
    it('should return user by email', async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      const result = await repository.findByEmail('user@example.com');
      expect(result).toEqual(mockUser);
    });
  });

  describe('findById', () => {
    it('should return user by id', async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      const result = await repository.findById('user-uuid-1');
      expect(result).toEqual(mockUser);
    });
  });

  describe('createGoogleUser', () => {
    it('should create a new google user record', async () => {
      prismaMock.user.create.mockResolvedValue({
        ...mockUser,
        googleId: 'google-123',
        isEmailVerified: true,
      });

      const result = await repository.createGoogleUser({
        email: 'user@example.com',
        googleId: 'google-123',
        displayName: 'John Doe',
      });

      expect(result.googleId).toBe('google-123');
      expect(result.isEmailVerified).toBe(true);
    });
  });

  describe('updateProfile', () => {
    it('should update user display name and avatar', async () => {
      const updatedUser = { ...mockUser, displayName: 'Updated Name' };
      prismaMock.user.update.mockResolvedValue(updatedUser);

      const result = await repository.updateProfile('user-uuid-1', {
        displayName: 'Updated Name',
      });

      expect(result.displayName).toBe('Updated Name');
    });
  });

  describe('updatePassword', () => {
    it('should update user password hash', async () => {
      prismaMock.user.update.mockResolvedValue(mockUser);

      await repository.updatePassword('user-uuid-1', 'new-hashed-password');

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
        data: { passwordHash: 'new-hashed-password' },
      });
    });
  });
});
