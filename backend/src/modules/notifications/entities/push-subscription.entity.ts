import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum PushProvider { FCM = 'fcm', WEB_PUSH = 'web_push' }

@Entity('push_subscriptions')
export class PushSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  userId: string;

  @Column({ type: 'enum', enum: PushProvider })
  provider: PushProvider;

  @Column({ type: 'text', nullable: true })
  fcmToken?: string;

  @Column({ type: 'text', nullable: true })
  endpoint?: string;

  @Column({ type: 'jsonb', nullable: true })
  keys?: Record<string, string>;

  @Column({ nullable: true })
  deviceInfo?: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
