import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { Goalkeeper } from '../../goalkeepers/entities/goalkeeper.entity';

export enum PerformanceClassification {
  ELITE = 'elite',
  EXCELLENT = 'excellent',
  GOOD = 'good',
  REGULAR = 'regular',
  DEVELOPING = 'developing',
}

export enum PerformanceSource {
  MATCH = 'match',
  TRAINING = 'training',
}

@Entity('performance_indexes')
export class PerformanceIndex {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Goalkeeper, (gk) => gk.performanceIndexes)
  @JoinColumn({ name: 'goalkeeperId' })
  goalkeeper: Goalkeeper;

  @Index()
  @Column()
  goalkeeperId: string;

  @Column({ nullable: true })
  matchId?: string;

  @Column({ nullable: true })
  trainingSessionId?: string;

  @Column({ type: 'enum', enum: PerformanceSource })
  source: PerformanceSource;

  @Column({ type: 'date' })
  date: Date;

  // Individual category scores (0–10)
  @Column({ type: 'decimal', precision: 4, scale: 2, default: 0 })
  reflexScore: number;

  @Column({ type: 'decimal', precision: 4, scale: 2, default: 0 })
  positioningScore: number;

  @Column({ type: 'decimal', precision: 4, scale: 2, default: 0 })
  highSaveScore: number;

  @Column({ type: 'decimal', precision: 4, scale: 2, default: 0 })
  lowSaveScore: number;

  @Column({ type: 'decimal', precision: 4, scale: 2, default: 0 })
  interceptionScore: number;

  @Column({ type: 'decimal', precision: 4, scale: 2, default: 0 })
  goalExitScore: number;

  @Column({ type: 'decimal', precision: 4, scale: 2, default: 0 })
  footworkScore: number;

  @Column({ type: 'decimal', precision: 4, scale: 2, default: 0 })
  distributionScore: number;

  @Column({ type: 'decimal', precision: 4, scale: 2, default: 0 })
  decisionMakingScore: number;

  @Column({ type: 'decimal', precision: 4, scale: 2, default: 0 })
  overallScore: number;

  @Column({ type: 'enum', enum: PerformanceClassification, nullable: true })
  classification?: PerformanceClassification;

  @Column({ nullable: true })
  season?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
