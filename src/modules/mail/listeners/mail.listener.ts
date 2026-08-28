import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { AUTH_EVENTS } from '../../auth/events/auth-events.constants';
import { WORKSPACE_EVENTS } from '../../workspace/events/workspace-events.constants';
import type { UserRegisteredEvent } from '../../auth/events/auth.events';
import type { EmailVerificationRequestedEvent } from '../../auth/events/auth.events';
import type { EmailVerifiedEvent } from '../../auth/events/auth.events';
import type { PasswordResetRequestedEvent } from '../../auth/events/auth.events';
import type { WorkspaceInvitationCreatedEvent } from '../../workspace/events/workspace.events';

/**
 * Consumes auth/workspace events and sends transactional emails.
 * CONTAINMENT RULE: a mail failure MUST NOT propagate — log and swallow.
 */
@Injectable()
export class MailListener {
  private readonly logger = new Logger(MailListener.name);

  constructor(
    private readonly mailerService: MailerService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Sends the combined welcome + email-verification message after registration.
   */
  @OnEvent(AUTH_EVENTS.registered)
  async onRegistered(event: UserRegisteredEvent): Promise<void> {
    if (!event.verificationToken) {
      this.logger.warn(
        `registered event without verification token for ${event.email}; skipping verify link`,
      );
      return;
    }
    try {
      const clientUrl = this.config.get<string>(
        'CLIENT_URL',
        'http://localhost:3001',
      );
      await this.mailerService.sendMail({
        to: event.email,
        subject: 'Welcome to SyncBoard — verify your email',
        template: 'welcome-verify',
        context: {
          displayName: event.displayName ?? '',
          verifyUrl: `${clientUrl}/verify-email?token=${encodeURIComponent(event.verificationToken)}`,
          expiresHours: 24,
        },
      });
      this.logger.log(`Welcome/verification email sent to ${event.email}`);
    } catch (error) {
      this.logger.error(
        `welcome-verify email failed for ${event.email}`,
        (error as Error).stack,
      );
    }
  }

  /**
   * Sends a fresh verification link when the user requests it again.
   */
  @OnEvent(AUTH_EVENTS.emailVerificationRequested)
  async onEmailVerificationRequested(
    event: EmailVerificationRequestedEvent,
  ): Promise<void> {
    try {
      const clientUrl = this.config.get<string>(
        'CLIENT_URL',
        'http://localhost:3001',
      );
      await this.mailerService.sendMail({
        to: event.email,
        subject: 'Verify your SyncBoard email',
        template: 'welcome-verify',
        context: {
          displayName: '',
          verifyUrl: `${clientUrl}/verify-email?token=${encodeURIComponent(event.token)}`,
          expiresHours: 24,
        },
      });
      this.logger.log(`Verification email sent to ${event.email}`);
    } catch (error) {
      this.logger.error(
        `verification email failed for ${event.email}`,
        (error as Error).stack,
      );
    }
  }

  /**
   * Confirms to the user that their email address has been verified,
   * closing the verification loop.
   */
  @OnEvent(AUTH_EVENTS.emailVerified)
  async onEmailVerified(event: EmailVerifiedEvent): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: event.email,
        subject: 'Your SyncBoard email is verified',
        template: 'email-verified',
        context: {
          displayName: event.displayName ?? '',
        },
      });
      this.logger.log(`Email-verified confirmation sent to ${event.email}`);
    } catch (error) {
      this.logger.error(
        `email-verified email failed for ${event.email}`,
        (error as Error).stack,
      );
    }
  }

  /**
   * Sends the password-reset link with a single-use token.
   */
  @OnEvent(AUTH_EVENTS.passwordResetRequested)
  async onPasswordResetRequested(
    event: PasswordResetRequestedEvent,
  ): Promise<void> {
    try {
      const clientUrl = this.config.get<string>(
        'CLIENT_URL',
        'http://localhost:3001',
      );
      await this.mailerService.sendMail({
        to: event.email,
        subject: 'Reset your SyncBoard password',
        template: 'password-reset',
        context: {
          resetUrl: `${clientUrl}/reset-password?token=${encodeURIComponent(event.token)}`,
          expiresMinutes: 60,
        },
      });
      this.logger.log(`Password reset email sent to ${event.email}`);
    } catch (error) {
      this.logger.error(
        `password-reset email failed for ${event.email}`,
        (error as Error).stack,
      );
    }
  }

  /**
   * Sends the workspace invitation with the accept link.
   */
  @OnEvent(WORKSPACE_EVENTS.invitationCreated)
  async onInvitationCreated(
    event: WorkspaceInvitationCreatedEvent,
  ): Promise<void> {
    try {
      const clientUrl = this.config.get<string>(
        'CLIENT_URL',
        'http://localhost:3001',
      );
      await this.mailerService.sendMail({
        to: event.email,
        subject: "You're invited to join a workspace on SyncBoard",
        template: 'invitation',
        context: {
          workspaceName: '',
          inviterName: '',
          acceptUrl: `${clientUrl}/invitations/${event.token}/accept`,
        },
      });
      this.logger.log(`Invitation email sent to ${event.email}`);
    } catch (error) {
      this.logger.error(
        `invitation email failed for ${event.email}`,
        (error as Error).stack,
      );
    }
  }
}
