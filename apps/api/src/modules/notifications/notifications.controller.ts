import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll(
    @CurrentUser() user: { id: string },
    @Query() query: PaginationQueryDto & { unreadOnly?: string }
  ) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const where: any = { userId: user.id };
    if (query.unreadOnly === 'true') where.readAt = null;

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.notification.count({ where }),
    ]);

    const unreadCount = await this.prisma.notification.count({
      where: { userId: user.id, readAt: null },
    });

    return { items, total, page, pageSize, unreadCount };
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: { id: string }) {
    const count = await this.prisma.notification.count({
      where: { userId: user.id, readAt: null },
    });
    return { count };
  }

  @Patch('read-all')
  @Post('read-all')
  async markAllRead(@CurrentUser() user: { id: string }) {
    await this.prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true };
  }

  @Patch(':id/read')
  async markOneRead(
    @CurrentUser() user: { id: string },
    @Param('id') id: string
  ) {
    await this.prisma.notification.updateMany({
      where: { id, userId: user.id },
      data: { readAt: new Date() },
    });
    return { success: true };
  }

  @Patch('read')
  async markRead(
    @CurrentUser() user: { id: string },
    @Body() body: { ids: string[] }
  ) {
    const ids = Array.isArray(body.ids) ? body.ids : [];
    if (ids.length === 0) return { success: true };
    await this.prisma.notification.updateMany({
      where: { id: { in: ids }, userId: user.id },
      data: { readAt: new Date() },
    });
    return { success: true };
  }
}