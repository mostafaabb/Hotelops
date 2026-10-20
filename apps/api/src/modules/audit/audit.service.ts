import { Injectable } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    userId: string | null,
    organizationId: string,
    action: AuditAction,
    entity: string,
    entityId: string | null,
    options?: {
      oldValue?: unknown;
      newValue?: unknown;
      ip?: string;
      userAgent?: string;
    }
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          organizationId,
          action,
          entity,
          entityId,
          oldValue: options?.oldValue ? (options.oldValue as any) : undefined,
          newValue: options?.newValue ? (options.newValue as any) : undefined,
          ipAddress: options?.ip,
          userAgent: options?.userAgent,
        },
      });
    } catch (error) {
      // Audit must never break the main flow
      console.error('Failed to write audit log', error);
    }
  }
}