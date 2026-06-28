import {
  Controller, Get, Post, Patch, Delete, Param, Query, Body,
  UseGuards, Request, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService, SubscribeDto } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('subscribe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Register FCM token or Web Push subscription' })
  subscribe(@Request() req: any, @Body() body: SubscribeDto) {
    return this.notificationsService.subscribe(req.user.id, body);
  }

  @Post('unsubscribe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate a push subscription by token/endpoint' })
  unsubscribe(@Request() req: any, @Body() body: { token: string }) {
    return this.notificationsService.unsubscribe(req.user.id, body.token);
  }

  @Get('subscriptions')
  @ApiOperation({ summary: 'List active push subscriptions for current user' })
  getSubscriptions(@Request() req: any) {
    return this.notificationsService.getSubscriptions(req.user.id);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Count unread notifications' })
  countUnread(@Request() req: any) {
    return this.notificationsService.countUnread(req.user.id).then((count) => ({ count }));
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
  remove(@Param('id') id: string, @Request() req: any) {
    return this.notificationsService.remove(id, req.user.id);
  }
}
