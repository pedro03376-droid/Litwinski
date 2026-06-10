import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, OneToMany, JoinColumn,
} from 'typeorm';
import { Goalkeeper } from '../../goalkeepers/entities/goalkeeper.entity';
import { Exercise } from './exercise.entity';
import { AiAnalysis } from '../../ai-analysis/entities/ai-analysis.entity';

export enum TrainingIntensity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  MAX = 'max',
}

export enum TrainingCategory {
  REFLEX = 'reflex',
  HIGH_SAVE = 'high_save',
  LOW_SAVE = 'low_save',
  POSITIONING = 'positioning',
  GOAL_EXIT = 'goal_exit',
  ONE_ON_ONE = 'one_on_one',
  DISTRIBUTION = 'distribution',
  FOOTWORK = 'footwork',
  COORDINATION = 'coordination',
  AGILITY = 'agility',
  REACTION_TIME = 'reaction_time',
  MIXED = 'mixed',
}

@Entity('training_sessions')
export class TrainingSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'enum', enum: TrainingCategory, default: TrainingCategory.MIXED })
  category: TrainingCategory;

  @Column()
  objective: string;

  @Column({ type: 'int', nullable: true })
  durationMinutes?: number;

  @Column({ type: 'enum', enum: TrainingIntensity, default: TrainingIntensity.MEDIUM })
  intensity: TrainingIntensity;

  @Column({ type: 'text', nullable: true })
  observations?: string;

  @Column({ nullable: true })
  season?: string;

  @ManyToOne(() => Goalkeeper, (gk) => gk.trainingSessions)
  @JoinColumn({ name: 'goalkeeperId' })
  goalkeeper: Goalkeeper;

  @Column()
  goalkeeperId: string;

  @OneToMany(() => Exercise, (ex) => ex.trainingSession, { cascade: true })
  exercises: Exercise[];

  @OneToMany(() => AiAnalysis, (ai) => ai.trainingSession)
  aiAnalyses: AiAnalysis[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
