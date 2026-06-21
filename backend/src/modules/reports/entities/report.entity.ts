import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { Goalkeeper } from '../../goalkeepers/entities/goalkeeper.entity';

export enum ReportType {
  MATCH = 'match',
  TRAINING = 'training',
  PERIOD = 'period',
  SEASON = 'season',
  COMPARISON = 'comparison',
}

@Entity('reports')
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'enum', enum: ReportType })
  type: ReportType;

  @Column({ nullable: true })
  pdfUrl?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({ nullable: true })
  dateFrom?: Date;

  @Column({ nullable: true })
  dateTo?: Date;

  @ManyToOne(() => Goalkeeper)
  @JoinColumn({ name: 'goalkeeperId' })
  goalkeeper: Goalkeeper;

  @Index()
  @Column()
  goalkeeperId: string;

  @CreateDateColumn()
  createdAt: Date;
}
