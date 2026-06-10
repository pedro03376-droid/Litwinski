import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Match } from '../../matches/entities/match.entity';

@Entity('match_scouts')
export class MatchScout {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Match, (match) => match.scouts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'matchId' })
  match: Match;

  @Column()
  matchId: string;

  // Defesas Altas
  @Column({ default: 0 }) highSaveRight: number;
  @Column({ default: 0 }) highSaveLeft: number;

  // Defesas Baixas
  @Column({ default: 0 }) lowSaveRight: number;
  @Column({ default: 0 }) lowSaveLeft: number;

  // Defesa Central
  @Column({ default: 0 }) centralSave: number;

  // Distribuição
  @Column({ default: 0 }) launchRightFoot: number;
  @Column({ default: 0 }) launchLeftFoot: number;
  @Column({ default: 0 }) launchRightHand: number;

  // Ações Defensivas
  @Column({ default: 0 }) interceptions: number;
  @Column({ default: 0 }) clearances: number;

  // Posicionamento
  @Column({ default: 0 }) positionBaseLeft: number;
  @Column({ default: 0 }) positionBaseRight: number;

  // Gols Sofridos
  @Column({ default: 0 }) goalOutsideArea: number;
  @Column({ default: 0 }) goalInsideArea: number;

  // Heatmap data (JSON)
  @Column({ type: 'jsonb', nullable: true })
  heatmapData?: HeatmapData;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;

  get totalSaves(): number {
    return (
      this.highSaveRight + this.highSaveLeft +
      this.lowSaveRight + this.lowSaveLeft +
      this.centralSave
    );
  }

  get totalGoalsConceded(): number {
    return this.goalOutsideArea + this.goalInsideArea;
  }

  get savePercentage(): number {
    const totalShots = this.totalSaves + this.totalGoalsConceded;
    if (totalShots === 0) return 0;
    return Math.round((this.totalSaves / totalShots) * 100);
  }
}

export interface HeatmapData {
  saves: HeatmapPoint[];
  goals: HeatmapPoint[];
  interceptations: HeatmapPoint[];
  shotOrigins: HeatmapPoint[];
}

export interface HeatmapPoint {
  x: number;
  y: number;
  intensity?: number;
}
