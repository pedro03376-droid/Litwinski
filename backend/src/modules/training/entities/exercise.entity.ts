import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, OneToOne, JoinColumn,
} from 'typeorm';
import { TrainingSession } from './training-session.entity';
import { ExerciseResult } from './exercise-result.entity';

@Entity('exercises')
export class Exercise {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  objective?: string;

  @Column({ nullable: true })
  sets?: number;

  @Column({ nullable: true })
  repetitions?: number;

  @Column({ nullable: true })
  durationSeconds?: number;

  @Column({ nullable: true })
  restSeconds?: number;

  @Column({ nullable: true })
  videoUrl?: string;

  @Column({ nullable: true })
  imageUrl?: string;

  @ManyToOne(() => TrainingSession, (ts) => ts.exercises, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trainingSessionId' })
  trainingSession: TrainingSession;

  @Column()
  trainingSessionId: string;

  @OneToOne(() => ExerciseResult, (er) => er.exercise, { cascade: true })
  result?: ExerciseResult;

  @CreateDateColumn()
  createdAt: Date;
}
