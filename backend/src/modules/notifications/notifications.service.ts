import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';
import { PushSubscription, PushProvider } from './entities/push-subscription.entity';
import { FirebaseService } from './firebase.service';

export interface SubscribeDto {
  fcmToken?: string;
  endpoint?: string;
  keys?: Record<string, string>;
  deviceInfo?: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(PushSubscription)
    private readonly subscriptionRepo: Repository<PushSubscription>,
    private readonly firebase: FirebaseService,
  ) {}

  // ─── Subscriptions ────────────────────────────────────────────────────────

  async subscribe(userId: string, dto: SubscribeDto): Promise<PushSubscription> {
    const provider = dto.fcmToken ? PushProvider.FCM : PushProvider.WEB_PUSH;

    const existing = dto.fcmToken
      ? await this.subscriptionRepo.findOne({ where: { userId, fcmToken: dto.fcmToken } })
      : await this.subscriptionRepo.findOne({ where: { userId, endpoint: dto.endpoint } });

    if (existing) {
      existing.isActive = true;
      existing.deviceInfo = dto.deviceInfo ?? existing.deviceInfo;
      return this.subscriptionRepo.save(existing);
    }

    const sub = this.subscriptionRepo.create({
      userId,
      provider,
      fcmToken: dto.fcmToken,
      endpoint: dto.endpoint,
      keys: dto.keys,
      deviceInfo: dto.deviceInfo,
    });
    return this.subscriptionRepo.save(sub);
  }

  async unsubscribe(userId: string, token: string): Promise<void> {
    await this.subscriptionRepo.update(
      [
        { userId, fcmToken: token },
        { userId, endpoint: token },
      ].find(Boolean) as any,
      { isActive: false },
    );
  }

  async getSubscriptions(userId: string): Promise<PushSubscription[]> {
    return this.subscriptionRepo.find({ where: { userId, isActive: true } });
  }

  // ─── Notifications ────────────────────────────────────────────────────────

  async findForUser(userId: string, unreadOnly = false) {
    const where: any = { userId };
    if (unreadOnly) where.isRead = false;
    return this.notificationRepo.find({ where, order: { createdAt: 'DESC' }, take: 50 });
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
    const saved = await this.notificationRepo.save(notification);
    this._dispatchPush(dto.userId, dto.title, dto.body, dto.data as Record<string, string> | undefined);
    return saved;
  }

  private _dispatchPush(userId: string, title: string, body: string, data?: Record<string, string>): void {
    this.subscriptionRepo
      .find({ where: { userId, isActive: true } })
      .then((subs) => {
        const tokens = subs.map((s) => s.fcmToken).filter(Boolean) as string[];
        return this.firebase.sendToTokens(tokens, title, body, data);
      })
      .catch(() => {/* fire-and-forget – ignore errors */});
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

  async countUnread(userId: string): Promise<number> {
    return this.notificationRepo.count({ where: { userId, isRead: false } });
  }

  // ─── Alert helpers ────────────────────────────────────────────────────────

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

  async sendTrainingReminder(userId: string, goalkeeperName: string) {
    return this.create({
      userId,
      title: 'Lembrete de Treino',
      body: `${goalkeeperName} não tem treinos registrados esta semana.`,
      type: NotificationType.TRAINING_REMINDER,
    });
  }
}
