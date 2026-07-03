import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';

export enum ExerciseCategory {
  REFLEX = 'reflex',
  AERIAL = 'aerial',
  LATERAL_DIVE = 'lateral_dive',
  POSITIONING = 'positioning',
  GOAL_EXIT = 'goal_exit',
  ONE_V_ONE = 'one_v_one',
  SHORT_DISTRIBUTION = 'short_distribution',
  LONG_DISTRIBUTION = 'long_distribution',
  COMMUNICATION = 'communication',
  DECISION_MAKING = 'decision_making',
  COORDINATION = 'coordination',
  AGILITY = 'agility',
  EXPLOSIVENESS = 'explosiveness',
  ENDURANCE = 'endurance',
}

@Entity('tp_exercise_library')
export class TpExercise {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ nullable: true })
  teamId?: string;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: ExerciseCategory })
  category: ExerciseCategory;

  @Column({ type: 'text', nullable: true })
  objective?: string;

  @Column({ type: 'int', default: 3 })
  difficulty: number; // 1–5

  @Column({ type: 'int', nullable: true })
  estimatedMinutes?: number;

  @Column({ type: 'text', nullable: true })
  materials?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ nullable: true })
  imageUrl?: string;

  @Column({ nullable: true })
  videoUrl?: string;

  @CreateDateColumn()
  createdAt: Date;
}
