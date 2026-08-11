import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AUTH_CONFIG } from '../auth.constants';

/**
 * Service providing secure password hashing and verification using bcrypt.
 */
@Injectable()
export class PasswordService {
  /**
   * Hash a plain-text password with bcrypt. Uses salt rounds from AUTH_CONFIG.
   */
  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, AUTH_CONFIG.password.bcryptRounds);
  }

  /**
   * Compare a plain-text password against a bcrypt hash.
   */
  async verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
