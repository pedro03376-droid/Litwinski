import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
  ) {}

  async findForUser(userId: string, unreadOnly = false) {
    const where: any = { userId };
    if (unreadOnly) where.isRead = false;
    return this.notificationRepo.find({
      where,
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async create(dto: {
    userId: string;
    title: string;
    body: string;
    type?: NotificationType;
    data?: Record<string, any>;
  }): Promise<Notification> {
    const notification = this.notificationRepo.create({
      userId: dto.userId,
      title: dto.title,
      body: dto.body,
      type: dto.type || NotificationType.GENERAL,
      data: dto.data,
    });
    return this.notificationRepo.save(notification);
  }

  async markAsRead(id: string, userId: string): Promise<void> {
    await this.notificationRepo.update({ id, userId }, { isRead: true });
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepo.update({ userId, isRead: false }, { isRead: true });
  }

  async remove(id: string): Promise<void> {
    await this.notificationRepo.delete(id);
  }

  async sendPerformanceDropAlert(userId: string, goalkeeperName: string, score: number) {
    return this.create({
      userId,
      title: 'Alerta de Queda de Desempenho',
      body: `${goalkeeperName} registrou nota ${score.toFixed(1)} – abaixo da média histórica.`,
      type: NotificationType.PERFORMANCE_DROP,
      data: { score },
    });
  }

  async sendGoalAchievedAlert(userId: string, goalkeeperName: string, achievement: string) {
    return this.create({
      userId,
      title: 'Meta Atingida!',
      body: `${goalkeeperName} atingiu: ${achievement}`,
      type: NotificationType.GOAL_ACHIEVED,
    });
  }

  async sendReportReady(userId: string, reportTitle: string, reportId: string) {
    return this.create({
      userId,
      title: 'Relatório Pronto',
      body: `O relatório "${reportTitle}" está disponível.`,
      type: NotificationType.REPORT_READY,
      data: { reportId },
    });
  }
}
