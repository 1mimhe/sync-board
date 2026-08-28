import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';
import { MailListener } from './listeners/mail.listener';

@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        transport: {
          host: config.get<string>('SMTP_HOST', 'localhost'),
          port: config.get<number>('SMTP_PORT', 1025),
          secure: config.get<boolean>('SMTP_SECURE', false),
          ...(config.get<string>('SMTP_USER')
            ? {
                auth: {
                  user: config.get<string>('SMTP_USER') as string,
                  pass: config.get<string>('SMTP_PASS', ''),
                },
              }
            : {}),
        },
        defaults: {
          from: config.get<string>(
            'MAIL_FROM',
            'SyncBoard <no-reply@syncboard.local>',
          ),
        },
        template: {
          dir: join(__dirname, 'templates'),
          adapter: new HandlebarsAdapter(),
          options: { strict: true },
        },
      }),
    }),
  ],
  providers: [MailListener],
})
export class MailModule {}
