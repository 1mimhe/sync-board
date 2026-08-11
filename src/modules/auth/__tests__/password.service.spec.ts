import { Test, TestingModule } from '@nestjs/testing';
import { PasswordService } from '../services/password.service';

describe('PasswordService', () => {
  let service: PasswordService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PasswordService],
    }).compile();

    service = module.get<PasswordService>(PasswordService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should hash a password and verify it successfully', async () => {
    const rawPassword = 'SecureP@ss123!';
    const hash = await service.hash(rawPassword);

    expect(hash).toBeDefined();
    expect(hash).not.toEqual(rawPassword);

    const isValid = await service.verify(rawPassword, hash);
    expect(isValid).toBe(true);
  });

  it('should return false when verifying an incorrect password', async () => {
    const rawPassword = 'SecureP@ss123!';
    const wrongPassword = 'WrongP@ssword1';
    const hash = await service.hash(rawPassword);

    const isValid = await service.verify(wrongPassword, hash);
    expect(isValid).toBe(false);
  });
});
