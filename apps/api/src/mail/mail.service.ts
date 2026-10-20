import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface MailOptions {
  to: string;
  subject: string;
  text: string;
  template?: string;
}

export interface MailProvider {
  send(options: MailOptions): Promise<boolean>;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly provider: MailProvider;
  private readonly devMode: boolean;

  constructor(private readonly configService: ConfigService) {
    this.devMode = this.configService.get<string>('EMAIL_DEV_MODE', 'true') === 'true';
    this.provider = this.selectProvider();
  }

  private selectProvider(): MailProvider {
    const host = this.configService.get<string>('SMTP_HOST');
    if (host && this.devMode === false) {
      return this.createSmtpProvider();
    }
    return this.createDevProvider();
  }

  private createDevProvider(): MailProvider {
    return {
      send: async (options: MailOptions) => {
        this.logger.log(`[DEV MAIL] To=${options.to} Subject="${options.subject}"`);
        this.logger.log(`[DEV MAIL] Body: ${options.text.substring(0, 500)}`);
        return true;
      },
    };
  }

  private createSmtpProvider(): MailProvider {
    const nodemailer = this.tryRequireNodemailer();
    if (!nodemailer) {
      this.logger.warn('nodemailer not available, falling back to dev mail mode');
      return this.createDevProvider();
    }
    const transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: Number(this.configService.get<string>('SMTP_PORT', '587')),
      secure: false,
      auth: this.configService.get<string>('SMTP_USER')
        ? {
            user: this.configService.get<string>('SMTP_USER'),
            pass: this.configService.get<string>('SMTP_PASSWORD'),
          }
        : undefined,
    });
    return {
      send: async (options: MailOptions) => {
        await transporter.sendMail({
          from: this.configService.get<string>('SMTP_FROM', 'HotelOps <no-reply@hotelops.app>'),
          to: options.to,
          subject: options.subject,
          text: options.text,
        });
        return true;
      },
    };
  }

  private tryRequireNodemailer(): any {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return require('nodemailer');
    } catch {
      return null;
    }
  }

  async send(options: MailOptions): Promise<boolean> {
    try {
      return await this.provider.send(options);
    } catch (error) {
      this.logger.error(`Failed to send email to ${options.to}`, error);
      return false;
    }
  }
}