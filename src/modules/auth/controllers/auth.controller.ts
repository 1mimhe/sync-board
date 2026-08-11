import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import type { User } from '@prisma/client';
import { AuthService } from '../services/auth.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { AnonymousGuard } from '../../../common/guards/anonymous.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import type { AuthResponse, TokenPair } from '../interfaces/auth-response.interface';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';
import {
  REFRESH_TOKEN_COOKIE_NAME,
  getRefreshTokenCookieOptions,
} from '../auth.constants';

/**
 * Controller providing REST API endpoints for user authentication,
 * token management, profile updates, and Google OAuth flow.
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AnonymousGuard)
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 400, description: 'Validation error — invalid request body' })
  @ApiResponse({ status: 403, description: 'User is already authenticated' })
  @ApiResponse({ status: 409, description: 'Email is already registered' })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const response = await this.authService.register(
      dto,
      req.ip,
      req.headers['user-agent'],
    );
    res.cookie(
      REFRESH_TOKEN_COOKIE_NAME,
      response.tokens.refreshToken,
      getRefreshTokenCookieOptions(),
    );
    return response;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AnonymousGuard)
  @ApiOperation({ summary: 'Authenticate with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 400, description: 'Validation error — invalid request body' })
  @ApiResponse({ status: 401, description: 'Invalid email or password' })
  @ApiResponse({ status: 403, description: 'User is already authenticated' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const response = await this.authService.login(
      dto,
      req.ip,
      req.headers['user-agent'],
    );
    res.cookie(
      REFRESH_TOKEN_COOKIE_NAME,
      response.tokens.refreshToken,
      getRefreshTokenCookieOptions(),
    );
    return response;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({ status: 200, description: 'Token pair refreshed successfully' })
  @ApiResponse({ status: 400, description: 'Validation error — invalid request body' })
  @ApiResponse({
    status: 401,
    description: 'Invalid, expired, or reused refresh token',
  })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TokenPair> {
    const rawToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME] || dto.refreshToken;
    if (!rawToken) {
      throw new UnauthorizedException('TOKEN_INVALID');
    }

    const tokens = await this.authService.refreshTokens(
      rawToken,
      req.ip,
      req.headers['user-agent'],
    );

    res.cookie(
      REFRESH_TOKEN_COOKIE_NAME,
      tokens.refreshToken,
      getRefreshTokenCookieOptions(),
    );

    return tokens;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout current device (revoke refresh token)' })
  @ApiResponse({ status: 204, description: 'Device logged out successfully' })
  @ApiResponse({ status: 400, description: 'Validation error — invalid request body' })
  async logout(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    const rawToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME] || dto.refreshToken;
    if (rawToken) {
      await this.authService.logout(
        rawToken,
        user.jti,
        new Date(user.exp * 1000),
      );
    }
    res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
      ...getRefreshTokenCookieOptions(),
      maxAge: 0,
    });
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout from all devices' })
  @ApiResponse({
    status: 204,
    description: 'All device sessions revoked successfully',
  })
  async logoutAll(
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.authService.logoutAllDevices(
      user.sub,
      user.jti,
      new Date(user.exp * 1000),
    );
    res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
      ...getRefreshTokenCookieOptions(),
      maxAge: 0,
    });
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AnonymousGuard)
  @ApiOperation({ summary: 'Request password reset link email' })
  @ApiResponse({
    status: 200,
    description: 'Password reset email queued if user exists',
  })
  @ApiResponse({ status: 400, description: 'Validation error — invalid request body' })
  @ApiResponse({ status: 403, description: 'User is already authenticated' })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.forgotPassword(dto.email);
    return {
      message:
        'If that email exists in our system, a password reset link has been sent.',
    };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AnonymousGuard)
  @ApiOperation({ summary: 'Reset password using valid reset token' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Validation error — invalid request body' })
  @ApiResponse({ status: 401, description: 'Invalid or expired reset token' })
  @ApiResponse({ status: 403, description: 'User is already authenticated' })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return {
      message:
        'Password reset successfully. Please log in with your new password.',
    };
  }

  @Get('google')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AnonymousGuard)
  @ApiOperation({ summary: 'Get Google OAuth authorization URL for frontend' })
  @ApiResponse({ status: 200, description: 'Google OAuth authorization URL' })
  @ApiResponse({ status: 403, description: 'User is already authenticated' })
  googleAuth(): { url: string } {
    return this.authService.getGoogleAuthUrl();
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth callback handler' })
  async googleCallback(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const user = req.user as User;
    const response = await this.authService.handleGoogleCallback(
      user,
      req.ip,
      req.headers['user-agent'],
    );
    res.cookie(
      REFRESH_TOKEN_COOKIE_NAME,
      response.tokens.refreshToken,
      getRefreshTokenCookieOptions(),
    );
    return response;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get authenticated user profile' })
  @ApiResponse({ status: 200, description: 'User profile metadata' })
  async getProfile(
    @CurrentUser() user: JwtPayload,
  ): Promise<Omit<User, 'passwordHash'>> {
    const profile = await this.authService.getProfile(user.sub);
    const { passwordHash, ...safeProfile } = profile;
    return safeProfile;
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation error — invalid request body' })
  async updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ): Promise<Omit<User, 'passwordHash'>> {
    const updated = await this.authService.updateProfile(user.sub, dto);
    const { passwordHash, ...safeProfile } = updated;
    return safeProfile;
  }

  @Patch('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change current user password' })
  @ApiResponse({ status: 204, description: 'Password changed successfully' })
  @ApiResponse({ status: 400, description: 'Validation error — invalid request body' })
  @ApiResponse({ status: 401, description: 'Current password is incorrect' })
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.authService.changePassword(user.sub, dto);
  }
}
