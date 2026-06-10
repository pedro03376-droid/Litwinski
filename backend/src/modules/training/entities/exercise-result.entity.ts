import {
  Entity, PrimaryGeneratedColumn, Column,
  OneToOne, JoinColumn, CreateDateColumn,
} from 'typeorm';
import { Exercise } from './exercise.entity';

@Entity('exercise_results')
export class ExerciseResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Exercise, (ex) => ex.result, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'exerciseId' })
  exercise: Exercise;

  @Column()
  exerciseId: string;

  @Column({ default: 0 })
  attempts: number;

  @Column({ default: 0 })
  successes: number;

  @Column({ default: 0 })
  errors: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  successPercentage?: number;

  @Column({ type: 'decimal', precision: 6, scale: 3, nullable: true })
  reactionTimeSeconds?: number;

  @Column({ type: 'text', nullable: true })
  observations?: string;

  @CreateDateColumn()
  createdAt: Date;
}
