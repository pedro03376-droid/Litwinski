import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, OneToMany, JoinColumn, Index,
} from 'typeorm';
import { Goalkeeper } from '../../goalkeepers/entities/goalkeeper.entity';
import { MatchScout } from '../../scouts/entities/match-scout.entity';
import { AiAnalysis } from '../../ai-analysis/entities/ai-analysis.entity';

export enum MatchResult { WIN = 'win', DRAW = 'draw', LOSS = 'loss' }
export enum MatchLocation { HOME = 'home', AWAY = 'away', NEUTRAL = 'neutral' }

@Entity('matches')
export class Match {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  date: Date;

  @Column()
  competition: string;

  @Column()
  opponent: string;

  @Column({ type: 'enum', enum: MatchLocation, default: MatchLocation.HOME })
  location: MatchLocation;

  @Column({ nullable: true })
  venue?: string;

  @Column({ default: 0 })
  goalsScored: number;

  @Column({ default: 0 })
  goalsConceded: number;

  @Column({ type: 'enum', enum: MatchResult, nullable: true })
  result?: MatchResult;

  @Column({ nullable: true })
  category?: string;

  @Column({ type: 'text', nullable: true })
  observations?: string;

  @Column({ nullable: true })
  videoUrl?: string;

  @Column({ nullable: true })
  season?: string;

  @ManyToOne(() => Goalkeeper, (gk) => gk.matches)
  @JoinColumn({ name: 'goalkeeperId' })
  goalkeeper: Goalkeeper;

  @Index()
  @Column()
  goalkeeperId: string;

  @OneToMany(() => MatchScout, (scout) => scout.match, { cascade: true })
  scouts: MatchScout[];

  @OneToMany(() => AiAnalysis, (ai) => ai.match)
  aiAnalyses: AiAnalysis[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
