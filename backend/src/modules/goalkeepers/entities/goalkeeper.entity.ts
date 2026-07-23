import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, OneToMany, JoinColumn, Index,
} from 'typeorm';
import { Team } from '../../teams/entities/team.entity';
import { Match } from '../../matches/entities/match.entity';
import { TrainingSession } from '../../training/entities/training-session.entity';
import { PerformanceIndex } from '../../performance/entities/performance-index.entity';

export enum DominantHand { RIGHT = 'right', LEFT = 'left' }
export enum DominantFoot { RIGHT = 'right', LEFT = 'left' }

@Entity('goalkeepers')
export class Goalkeeper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Código de origem: id do registro no aparelho/cliente. Permite espelhar
  // (criar-ou-atualizar) sem duplicar. Único por clube (teamId + externalId).
  @Index()
  @Column({ nullable: true })
  externalId?: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  photo?: string;

  @Column({ type: 'date' })
  birthDate: Date;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  height?: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  weight?: number;

  @Column({ type: 'enum', enum: DominantHand, default: DominantHand.RIGHT })
  dominantHand: DominantHand;

  @Column({ type: 'enum', enum: DominantFoot, default: DominantFoot.RIGHT })
  dominantFoot: DominantFoot;

  @Column()
  category: string;

  @Column({ nullable: true })
  jerseyNumber?: number;

  @Column({ type: 'text', nullable: true })
  observations?: string;

  @Column({ nullable: true })
  nationality?: string;

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => Team, (team) => team.goalkeepers, { eager: true })
  @JoinColumn({ name: 'teamId' })
  team: Team;

  @Column({ nullable: true })
  teamId?: string;

  @OneToMany(() => Match, (match) => match.goalkeeper)
  matches: Match[];

  @OneToMany(() => TrainingSession, (ts) => ts.goalkeeper)
  trainingSessions: TrainingSession[];

  @OneToMany(() => PerformanceIndex, (pi) => pi.goalkeeper)
  performanceIndexes: PerformanceIndex[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  get age(): number {
    const today = new Date();
    const birth = new Date(this.birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  }
}
