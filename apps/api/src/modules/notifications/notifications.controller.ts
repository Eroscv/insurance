import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { listNotificationsSchema, type ListNotificationsQuery } from '@insurance/shared';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  list(@Query(new ZodValidationPipe(listNotificationsSchema)) q: ListNotificationsQuery) {
    return this.service.list(q);
  }

  @Get('unread-count')
  unread() {
    return this.service.unreadCount();
  }

  @HttpCode(204)
  @Patch(':id/read')
  read(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.markRead(id);
  }

  @HttpCode(204)
  @Post('read-all')
  readAll() {
    return this.service.markAllRead();
  }
}
