import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, OneToMany,
} from 'typeorm';
import { Goalkeeper } from '../../goalkeepers/entities/goalkeeper.entity';

@Entity('teams')
export class Team {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  shield?: string;

  @Column()
  category: string;

  @Column({ nullable: true })
  city?: string;

  @Column({ nullable: true })
  state?: string;

  @Column({ nullable: true })
  country?: string;

  @Column({ nullable: true })
  foundedYear?: number;

  @Column({ type: 'text', nullable: true })
  technicalStaff?: string;

  @Column({ nullable: true })
  primaryColor?: string;

  @Column({ nullable: true })
  secondaryColor?: string;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => Goalkeeper, (gk) => gk.team)
  goalkeepers: Goalkeeper[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
