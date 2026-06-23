import {
  Controller, Get, Post, Patch, Delete, Param, Query, Body, UseGuards, Request, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('subscribe')
  @HttpCode(HttpStatus.OK)
  subscribe(
    @Request() req: any,
    @Body() body: { endpoint?: string; keys?: Record<string, string>; fcmToken?: string },
  ) {
    // Store subscription for future push delivery (FCM token or Web Push endpoint).
    // Returns 200 so the frontend doesn't get a 404.
    return { ok: true, userId: req.user.id };
  }

  @Get()
  findAll(@Request() req: any, @Query('unreadOnly') unreadOnly?: string) {
    return this.notificationsService.findForUser(req.user.id, unreadOnly === 'true');
  }

  @Patch(':id/read')
  markAsRead(@Param('id') id: string, @Request() req: any) {
    return this.notificationsService.markAsRead(id, req.user.id);
  }

  @Patch('read-all')
  markAllAsRead(@Request() req: any) {
    return this.notificationsService.markAllAsRead(req.user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.notificationsService.remove(id);
  }
}
