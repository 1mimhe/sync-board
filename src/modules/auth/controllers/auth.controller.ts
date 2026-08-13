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
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
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
  @Throttle(AUTH_THROTTLE_CONFIG.refresh)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiOkResponse({
    type: TokenPairDto,
    description: 'Token pair refreshed successfully',
  })
  @ApiBadRequestResponse({
    description: 'Validation error — invalid request body',
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid, expired, or reused refresh token',
  })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TokenPairDto> {
    const cookies = req.cookies as Record<string, unknown> | undefined;
    const cookieToken =
      typeof cookies?.[REFRESH_TOKEN_COOKIE_NAME] === 'string'
        ? cookies[REFRESH_TOKEN_COOKIE_NAME]
        : undefined;
    const rawToken = cookieToken || dto.refreshToken;

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
  @ApiNoContentResponse({ description: 'Device logged out successfully' })
  @ApiBadRequestResponse({
    description: 'Validation error — invalid request body',
  })
  async logout(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    const cookies = req.cookies as Record<string, unknown> | undefined;
    const cookieToken =
      typeof cookies?.[REFRESH_TOKEN_COOKIE_NAME] === 'string'
        ? cookies[REFRESH_TOKEN_COOKIE_NAME]
        : undefined;
    const rawToken = cookieToken || dto.refreshToken;

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
  @ApiOperation({ summary: 'Reset password using valid reset token' })
  @ApiOkResponse({
    type: MessageResponseDto,
    description: 'Password reset successfully',
  })
  @ApiBadRequestResponse({
    description: 'Validation error — invalid request body',
  })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired reset token' })
  @ApiForbiddenResponse({ description: 'User is already authenticated' })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<MessageResponseDto> {
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
  @ApiOkResponse({
    type: GoogleAuthUrlResponseDto,
    description: 'Google OAuth authorization URL',
  })
  @ApiForbiddenResponse({ description: 'User is already authenticated' })
  googleAuth(): GoogleAuthUrlResponseDto {
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
  @ApiOkResponse({
    type: UserResponseDto,
    description: 'User profile metadata',
  })
  async getProfile(@CurrentUser() user: JwtPayload): Promise<UserResponseDto> {
    return this.authService.getProfile(user.sub);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
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
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change current user password' })
  @ApiNoContentResponse({ description: 'Password changed successfully' })
  @ApiBadRequestResponse({
    description: 'Validation error — invalid request body',
  })
  @ApiUnauthorizedResponse({ description: 'Current password is incorrect' })
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.authService.changePassword(user.sub, dto);
  }
}
