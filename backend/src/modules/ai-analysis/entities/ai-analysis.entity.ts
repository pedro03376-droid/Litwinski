import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { Goalkeeper } from '../../goalkeepers/entities/goalkeeper.entity';
import { Match } from '../../matches/entities/match.entity';
import { TrainingSession } from '../../training/entities/training-session.entity';

export enum AnalysisSource { MATCH = 'match', TRAINING = 'training' }

@Entity('ai_analyses')
export class AiAnalysis {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Goalkeeper)
  @JoinColumn({ name: 'goalkeeperId' })
  goalkeeper: Goalkeeper;

  @Index()
  @Column()
  goalkeeperId: string;

  @ManyToOne(() => Match, (m) => m.aiAnalyses, { nullable: true })
  @JoinColumn({ name: 'matchId' })
  match?: Match;

  @Index()
  @Column({ nullable: true })
  matchId?: string;

  @ManyToOne(() => TrainingSession, (ts) => ts.aiAnalyses, { nullable: true })
  @JoinColumn({ name: 'trainingSessionId' })
  trainingSession?: TrainingSession;

  @Column({ nullable: true })
  trainingSessionId?: string;

  @Column({ type: 'enum', enum: AnalysisSource })
  source: AnalysisSource;

  @Column({ type: 'text', array: true, default: '{}' })
  strengths: string[];

  @Column({ type: 'text', array: true, default: '{}' })
  attentionPoints: string[];

  @Column({ type: 'text', array: true, default: '{}' })
  evolutionNotes: string[];

  @Column({ type: 'text', array: true, default: '{}' })
  trainingSuggestions: string[];

  @Column({ type: 'decimal', precision: 4, scale: 2, nullable: true })
  overallScore?: number;

  @Column({ type: 'jsonb', nullable: true })
  rawMetrics?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
