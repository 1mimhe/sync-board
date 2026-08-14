import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';
import { PasswordService } from './services/password.service';
import { JwtTokenService } from './services/jwt-token.service';
import { TokenBlacklistService } from './services/token-blacklist.service';
import { UserRepository } from './repositories/user.repository';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AnonymousGuard } from '../../common/guards/anonymous.guard';
import { TokenCleanupTask } from './tasks/token-cleanup.task';

@Module({
  imports: [PassportModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    UserRepository,
    RefreshTokenRepository,
    PasswordService,
    JwtTokenService,
    TokenBlacklistService,
    GoogleStrategy,
    JwtAuthGuard,
    AnonymousGuard,
    TokenCleanupTask,
  ],
  exports: [
    AuthService,
    JwtTokenService,
    JwtAuthGuard,
    AnonymousGuard,
    TokenBlacklistService,
    UserRepository,
    RefreshTokenRepository,
  ],
})
export class AuthModule {}
