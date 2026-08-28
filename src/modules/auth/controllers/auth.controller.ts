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
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiConflictResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { User } from '@prisma/client';
import { AuthService } from '../services/auth.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { AnonymousGuard } from '../../../common/guards/anonymous.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
  UpdateProfileDto,
  ChangePasswordDto,
  AuthResponseDto,
  TokenPairDto,
  UserResponseDto,
  MessageResponseDto,
  GoogleAuthUrlResponseDto,
} from '../dto';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';
import {
  REFRESH_TOKEN_COOKIE_NAME,
  getRefreshTokenCookieOptions,
  AUTH_THROTTLE_CONFIG,
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
  @Throttle(AUTH_THROTTLE_CONFIG.register)
  @UseGuards(AnonymousGuard)
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiCreatedResponse({
    type: AuthResponseDto,
    description: 'User registered successfully',
  })
  @ApiBadRequestResponse({
    description: 'Validation error — invalid request body',
  })
  @ApiForbiddenResponse({ description: 'User is already authenticated' })
  @ApiConflictResponse({ description: 'Email is already registered' })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const { user, tokens } = await this.authService.register(
      dto,
      req.ip,
      req.headers['user-agent'],
    );
    this.setAuthCookie(res, tokens.refreshToken);
    return {
      user,
      tokens: {
        accessToken: tokens.accessToken,
        expiresIn: tokens.expiresIn,
      },
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_THROTTLE_CONFIG.login)
  @UseGuards(AnonymousGuard)
  @ApiOperation({ summary: 'Authenticate with email and password' })
  @ApiOkResponse({
    type: AuthResponseDto,
    description: 'Login successful',
  })
  @ApiBadRequestResponse({
    description: 'Validation error — invalid request body',
  })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  @ApiForbiddenResponse({ description: 'User is already authenticated' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const { user, tokens } = await this.authService.login(
      dto,
      req.ip,
      req.headers['user-agent'],
    );
    this.setAuthCookie(res, tokens.refreshToken);
    return {
      user,
      tokens: {
        accessToken: tokens.accessToken,
        expiresIn: tokens.expiresIn,
      },
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_THROTTLE_CONFIG.refresh)
  @ApiOperation({
    summary: 'Refresh access token using httpOnly refresh token cookie',
  })
  @ApiOkResponse({
    type: TokenPairDto,
    description: 'Access token refreshed successfully',
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid, expired, or revoked refresh token',
  })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TokenPairDto> {
    const cookies = req.cookies as Record<string, unknown> | undefined;
    const rawToken =
      typeof cookies?.[REFRESH_TOKEN_COOKIE_NAME] === 'string'
        ? cookies[REFRESH_TOKEN_COOKIE_NAME]
        : undefined;

    if (!rawToken) {
      throw new UnauthorizedException('TOKEN_INVALID');
    }

    const tokens = await this.authService.refreshTokens(
      rawToken,
      req.ip,
      req.headers['user-agent'],
    );

    this.setAuthCookie(res, tokens.refreshToken);
    return {
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout current device (revoke refresh token)' })
  @ApiNoContentResponse({ description: 'Device logged out successfully' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    const cookies = req.cookies as Record<string, unknown> | undefined;
    const rawToken =
      typeof cookies?.[REFRESH_TOKEN_COOKIE_NAME] === 'string'
        ? cookies[REFRESH_TOKEN_COOKIE_NAME]
        : undefined;

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
  @ApiNoContentResponse({
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
  @Throttle(AUTH_THROTTLE_CONFIG.forgotPassword)
  @UseGuards(AnonymousGuard)
  @ApiOperation({ summary: 'Request password reset link email' })
  @ApiOkResponse({
    type: MessageResponseDto,
    description: 'Password reset email queued if user exists',
  })
  @ApiBadRequestResponse({
    description: 'Validation error — invalid request body',
  })
  @ApiForbiddenResponse({ description: 'User is already authenticated' })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<MessageResponseDto> {
    await this.authService.forgotPassword(dto.email);
    return {
      message:
        'If that email exists in our system, a password reset link has been sent.',
    };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_THROTTLE_CONFIG.resetPassword)
  @UseGuards(AnonymousGuard)
  @ApiOperation({
    summary:
      'Reset password using valid reset token and issue fresh access token',
  })
  @ApiOkResponse({
    type: TokenPairDto,
    description: 'Password reset successfully, user logged in with new tokens',
  })
  @ApiBadRequestResponse({
    description: 'Validation error — invalid request body',
  })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired reset token' })
  @ApiForbiddenResponse({ description: 'User is already authenticated' })
  async resetPassword(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: ResetPasswordDto,
  ): Promise<TokenPairDto> {
    const tokens = await this.authService.resetPassword(
      dto.token,
      dto.newPassword,
      req.ip,
      req.headers['user-agent'],
    );
    this.setAuthCookie(res, tokens.refreshToken);
    return {
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
    };
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_THROTTLE_CONFIG.resetPassword)
  @ApiOperation({ summary: 'Verify email address using single-use token' })
  @ApiOkResponse({
    type: MessageResponseDto,
    description: 'Email verified successfully',
  })
  @ApiBadRequestResponse({
    description: 'Validation error — invalid request body',
  })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<MessageResponseDto> {
    await this.authService.verifyEmail(dto.token);
    return { message: 'Email verified successfully.' };
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(AUTH_THROTTLE_CONFIG.forgotPassword)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Resend the email verification link to the current user',
  })
  @ApiNoContentResponse({
    description: 'Verification email queued if not already verified',
  })
  @ApiUnauthorizedResponse({
    description: 'Access token missing or invalid',
  })
  @ApiConflictResponse({ description: 'Email is already verified' })
  async resendVerification(@CurrentUser() user: JwtPayload): Promise<void> {
    await this.authService.requestEmailVerification(user.sub);
  }

  @Get('google')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AnonymousGuard)
  @ApiOperation({ summary: 'Get Google OAuth authorization URL for frontend' })
  @ApiOkResponse({
    type: GoogleAuthUrlResponseDto,
    description: 'Google OAuth authorization URL',
  })
  @ApiForbiddenResponse({ description: 'User is already authenticated' })
  async googleAuth(): Promise<GoogleAuthUrlResponseDto> {
    return this.authService.getGoogleAuthUrl();
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth callback handler' })
  @ApiOkResponse({
    type: AuthResponseDto,
    description: 'Google OAuth login successful',
  })
  async googleCallback(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const state = req.query?.state as string | undefined;
    await this.authService.validateOAuthState(state);

    const user = req.user as User;
    const { user: profile, tokens } =
      await this.authService.handleGoogleCallback(
        user,
        req.ip,
        req.headers['user-agent'],
      );
    this.setAuthCookie(res, tokens.refreshToken);
    return {
      user: profile,
      tokens: {
        accessToken: tokens.accessToken,
        expiresIn: tokens.expiresIn,
      },
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get authenticated user profile' })
  @ApiOkResponse({
    type: UserResponseDto,
    description: 'User profile metadata',
  })
  async getProfile(@CurrentUser() user: JwtPayload): Promise<UserResponseDto> {
    return this.authService.getProfile(user.sub);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @Throttle(AUTH_THROTTLE_CONFIG.updateProfile)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiOkResponse({
    type: UserResponseDto,
    description: 'Profile updated successfully',
  })
  @ApiBadRequestResponse({
    description: 'Validation error — invalid request body',
  })
  async updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    return this.authService.updateProfile(user.sub, dto);
  }

  @Patch('me/password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Throttle(AUTH_THROTTLE_CONFIG.changePassword)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Change current user password and issue fresh access token',
  })
  @ApiOkResponse({
    type: TokenPairDto,
    description: 'Password changed successfully and new tokens issued',
  })
  @ApiBadRequestResponse({
    description: 'Validation error — invalid request body',
  })
  @ApiUnauthorizedResponse({ description: 'Current password is incorrect' })
  async changePassword(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ): Promise<TokenPairDto> {
    const tokens = await this.authService.changePassword(
      user.sub,
      dto,
      user.jti,
      new Date(user.exp * 1000),
      req.ip,
      req.headers['user-agent'],
    );
    this.setAuthCookie(res, tokens.refreshToken);
    return {
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
    };
  }

  /**
   * Helper to set refresh token cookie on response.
   */
  private setAuthCookie(res: Response, refreshToken: string): void {
    res.cookie(
      REFRESH_TOKEN_COOKIE_NAME,
      refreshToken,
      getRefreshTokenCookieOptions(),
    );
  }
}
