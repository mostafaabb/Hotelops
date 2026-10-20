import { Injectable } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationType,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeGateway } from './realtime.gateway';
import { MailService } from '../../mail/mail.service';

interface CreateNotificationInput {
  userId: string;
  organizationId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  relatedId?: string;
  relatedType?: string;
  channel?: NotificationChannel;
}

interface NotifyRoleInput {
  roles: UserRole[];
  organizationId: string;
  hotelId?: string | null;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  relatedId?: string;
  relatedType?: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly mailService: MailService
  ) {}

  async create(input: CreateNotificationInput): Promise<string> {
    const channel = input.channel ?? NotificationChannel.IN_APP;
    const notification = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        organizationId: input.organizationId,
        type: input.type,
        channel,
        title: input.title,
        body: input.body,
        link: input.link,
        relatedId: input.relatedId,
        relatedType: input.relatedType,
      },
    });

    this.realtimeGateway.emitToUser(input.userId, 'notification:new', {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      link: notification.link,
      createdAt: notification.createdAt,
    });

    if (channel === NotificationChannel.EMAIL || channel === NotificationChannel.BOTH) {
      const user = await this.prisma.user.findUnique({
        where: { id: input.userId },
        select: { email: true, firstName: true },
      });
      if (user?.email) {
        this.mailService.send({
          to: user.email,
          subject: input.title,
          text: `${input.title}\n\n${input.body ?? ''}`,
        });
      }
    }

    return notification.id;
  }

  async notifyRole(input: NotifyRoleInput): Promise<void> {
    const where: any = {
      organizationId: input.organizationId,
      status: 'ACTIVE',
      role: { in: input.roles },
    };
    if (input.hotelId) {
      where.OR = [{ hotelId: input.hotelId }, { hotelId: null }];
    }

    const users = await this.prisma.user.findMany({
      where,
      select: { id: true },
    });

    for (const user of users) {
      await this.create({
        userId: user.id,
        organizationId: input.organizationId,
        type: input.type,
        title: input.title,
        body: input.body,
        link: input.link,
        relatedId: input.relatedId,
        relatedType: input.relatedType,
      });
    }
  }

  async sendMail(to: string, subject: string, text: string, template?: string) {
    return this.mailService.send({ to, subject, text, template });
  }
}