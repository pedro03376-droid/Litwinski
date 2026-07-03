import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, Unique,
} from 'typeorm';

export enum AttendanceStatus {
  PRESENT = 'present',   // ✅
  ABSENT = 'absent',     // ❌
  INJURED = 'injured',   // 🤕
  PARTIAL = 'partial',   // 🟡 participação parcial
}

@Entity('tp_attendance')
@Unique(['sessionId', 'goalkeeperId'])
export class TpAttendance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  sessionId: string;

  @Index()
  @Column()
  goalkeeperId: string;

  @Column({ type: 'enum', enum: AttendanceStatus, default: AttendanceStatus.PRESENT })
  status: AttendanceStatus;
}

/** Session RPE (0–10) per goalkeeper + internal load (duration × RPE). */
@Entity('tp_rpe')
@Unique(['sessionId', 'goalkeeperId'])
export class TpRpe {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  sessionId: string;

  @Index()
  @Column()
  goalkeeperId: string;

  @Column({ type: 'int' })
  value: number; // 0–10

  @Column({ type: 'int', nullable: true })
  durationMinutes?: number; // snapshot at record time

  @Column({ type: 'int', nullable: true })
  workload?: number; // UA = duration × value

  @Column({ type: 'text', nullable: true })
  comment?: string;

  @CreateDateColumn()
  createdAt: Date;
}

/** Technical / physical / mental evaluation per goalkeeper for a session.
 *  Sub-dimensions stored as jsonb (score 1–10 each) for flexibility + easy AI use. */
@Entity('tp_evaluations')
@Unique(['sessionId', 'goalkeeperId'])
export class TpEvaluation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  sessionId: string;

  @Index()
  @Column()
  goalkeeperId: string;

  // { reflex, aerial, lateralDive, positioning, goalExit, oneVOne, shortDistribution, longDistribution }
  @Column({ type: 'jsonb', default: {} })
  technical: Record<string, number>;

  // { agility, explosiveness, endurance, speed, coordination }
  @Column({ type: 'jsonb', default: {} })
  physical: Record<string, number>;

  // { communication, leadership, concentration, decisionMaking, confidence }
  @Column({ type: 'jsonb', default: {} })
  mental: Record<string, number>;

  @Column({ type: 'text', nullable: true })
  observations?: string;

  @CreateDateColumn()
  createdAt: Date;
}

export enum GoalStatus { ACTIVE = 'active', ACHIEVED = 'achieved', CANCELLED = 'cancelled' }

@Entity('tp_goals')
export class TpGoal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  goalkeeperId: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ nullable: true })
  fundamental?: string; // e.g. 'aerial', 'attendance', 'longDistribution'

  @Column({ type: 'int', default: 0 })
  progress: number; // 0–100

  @Column({ type: 'enum', enum: GoalStatus, default: GoalStatus.ACTIVE })
  status: GoalStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
