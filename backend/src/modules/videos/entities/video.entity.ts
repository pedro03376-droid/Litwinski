import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { Goalkeeper } from '../../goalkeepers/entities/goalkeeper.entity';

export enum VideoType { VIDEO = 'video', PHOTO = 'photo' }
export enum VideoContext { MATCH = 'match', TRAINING = 'training', EXERCISE = 'exercise' }
export enum VideoEventTag {
  SAVE = 'save',
  GOAL_CONCEDED = 'goal_conceded',
  INTERCEPTION = 'interception',
  TECHNICAL_ERROR = 'technical_error',
  TECHNICAL_SUCCESS = 'technical_success',
}

@Entity('videos')
export class Video {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column()
  url: string;

  @Column({ nullable: true })
  thumbnailUrl?: string;

  @Column({ type: 'enum', enum: VideoType, default: VideoType.VIDEO })
  type: VideoType;

  @Column({ type: 'enum', enum: VideoContext })
  context: VideoContext;

  @Column({ type: 'enum', enum: VideoEventTag, nullable: true })
  eventTag?: VideoEventTag;

  @Column({ nullable: true })
  matchId?: string;

  @Column({ nullable: true })
  trainingSessionId?: string;

  @Column({ nullable: true })
  exerciseId?: string;

  @Column({ nullable: true })
  durationSeconds?: number;

  @Column({ nullable: true })
  fileSizeBytes?: number;

  @Column({ default: false })
  isProcessed: boolean;

  @ManyToOne(() => Goalkeeper)
  @JoinColumn({ name: 'goalkeeperId' })
  goalkeeper: Goalkeeper;

  @Index()
  @Column()
  goalkeeperId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
