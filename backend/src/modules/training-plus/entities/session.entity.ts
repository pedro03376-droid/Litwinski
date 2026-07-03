import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  Index, OneToMany, ManyToOne, JoinColumn,
} from 'typeorm';

export enum SessionStatus {
  SCHEDULED = 'scheduled',   // 🟢 Agendado
  ONGOING = 'ongoing',       // 🟡 Em andamento
  FINISHED = 'finished',     // 🔵 Finalizado
  CANCELLED = 'cancelled',   // 🔴 Cancelado
}

export enum SessionBlockType {
  WARMUP = 'warmup',         // Aquecimento
  TECHNICAL = 'technical',   // Parte Técnica
  PHYSICAL = 'physical',     // Parte Física
  TACTICAL = 'tactical',     // Parte Tática
  GAME = 'game',             // Jogo Aplicado
  STRETCHING = 'stretching', // Alongamento
}

/** A team training session (planning + execution). Additive — does not touch
 *  the existing per-goalkeeper training_sessions table. */
@Entity('tp_sessions')
export class TpSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ nullable: true })
  teamId?: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ nullable: true })
  time?: string;

  @Column({ nullable: true })
  location?: string;

  @Column({ nullable: true })
  category?: string;

  @Column({ nullable: true })
  staff?: string; // Comissão técnica

  @Column({ nullable: true })
  title?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text', nullable: true })
  objective?: string;

  @Column({ type: 'text', nullable: true })
  observations?: string;

  @Column({ type: 'int', nullable: true })
  durationMinutes?: number;

  @Column({ type: 'int', nullable: true })
  plannedIntensity?: number; // 0–10, carga planejada

  @Column({ type: 'enum', enum: SessionStatus, default: SessionStatus.SCHEDULED })
  status: SessionStatus;

  @Column({ type: 'text', array: true, default: '{}' })
  exerciseIds: string[]; // referências à biblioteca

  @OneToMany(() => TpSessionBlock, (b) => b.session, { cascade: true })
  blocks: TpSessionBlock[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('tp_session_blocks')
export class TpSessionBlock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  sessionId: string;

  @Column({ type: 'enum', enum: SessionBlockType })
  type: SessionBlockType;

  @Column({ type: 'int', nullable: true })
  plannedMinutes?: number;

  @Column({ type: 'text', nullable: true })
  objective?: string;

  @Column({ type: 'text', nullable: true })
  observations?: string;

  @Column({ type: 'int', default: 0 })
  order: number;

  @ManyToOne(() => TpSession, (s) => s.blocks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sessionId' })
  session: TpSession;
}
