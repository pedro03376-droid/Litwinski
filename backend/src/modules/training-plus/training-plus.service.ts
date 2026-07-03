import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { TpSession, TpSessionBlock, SessionStatus } from './entities/session.entity';
import { TpExercise, ExerciseCategory } from './entities/exercise-library.entity';
import {
  TpAttendance, AttendanceStatus, TpRpe, TpEvaluation, TpGoal, GoalStatus,
} from './entities/records.entity';

const avg = (nums: number[]): number =>
  nums.length ? +(nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2) : 0;

const avgOfMap = (m: Record<string, number> = {}): number => {
  const vals = Object.values(m || {}).filter((v) => typeof v === 'number');
  return avg(vals as number[]);
};

@Injectable()
export class TrainingPlusService {
  constructor(
    @InjectRepository(TpSession) private readonly sessions: Repository<TpSession>,
    @InjectRepository(TpSessionBlock) private readonly blocks: Repository<TpSessionBlock>,
    @InjectRepository(TpExercise) private readonly exercises: Repository<TpExercise>,
    @InjectRepository(TpAttendance) private readonly attendance: Repository<TpAttendance>,
    @InjectRepository(TpRpe) private readonly rpe: Repository<TpRpe>,
    @InjectRepository(TpEvaluation) private readonly evals: Repository<TpEvaluation>,
    @InjectRepository(TpGoal) private readonly goals: Repository<TpGoal>,
  ) {}

  // ─── Sessions ───────────────────────────────────────────────────────────────
  async createSession(dto: Partial<TpSession> & { blocks?: Partial<TpSessionBlock>[] }) {
    const session = await this.sessions.save(this.sessions.create({ ...dto, blocks: undefined }));
    if (dto.blocks?.length) {
      await this.blocks.save(
        dto.blocks.map((b, i) => this.blocks.create({ ...b, sessionId: session.id, order: b.order ?? i })),
      );
    }
    return this.getSession(session.id);
  }

  async listSessions(filters: { teamId?: string; from?: string; to?: string; status?: SessionStatus } = {}) {
    const where: any = {};
    if (filters.teamId) where.teamId = filters.teamId;
    if (filters.status) where.status = filters.status;
    if (filters.from && filters.to) where.date = Between(filters.from, filters.to);
    return this.sessions.find({ where, order: { date: 'DESC', time: 'DESC' } });
  }

  async getSession(id: string) {
    const session = await this.sessions.findOne({ where: { id }, relations: ['blocks'] });
    if (!session) throw new NotFoundException(`Session ${id} not found`);
    const [attendance, rpe, evaluations] = await Promise.all([
      this.attendance.find({ where: { sessionId: id } }),
      this.rpe.find({ where: { sessionId: id } }),
      this.evals.find({ where: { sessionId: id } }),
    ]);
    (session.blocks || []).sort((a, b) => a.order - b.order);
    return { ...session, attendance, rpe, evaluations };
  }

  async updateSession(id: string, dto: Partial<TpSession>) {
    const session = await this.sessions.findOne({ where: { id } });
    if (!session) throw new NotFoundException(`Session ${id} not found`);
    Object.assign(session, dto);
    await this.sessions.save(session);
    return this.getSession(id);
  }

  async removeSession(id: string) {
    const res = await this.sessions.delete(id);
    if (!res.affected) throw new NotFoundException(`Session ${id} not found`);
  }

  // Replace the full set of blocks for a session (planner save).
  async setBlocks(sessionId: string, incoming: Partial<TpSessionBlock>[]) {
    const session = await this.sessions.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException(`Session ${sessionId} not found`);
    await this.blocks.delete({ sessionId });
    if (incoming?.length) {
      await this.blocks.save(
        incoming.map((b, i) => this.blocks.create({
          type: b.type,
          plannedMinutes: b.plannedMinutes ?? 0,
          objective: b.objective ?? null,
          observations: b.observations ?? null,
          order: b.order ?? i,
          sessionId,
        })),
      );
    }
    return this.getSession(sessionId);
  }

  // ─── Exercise library ───────────────────────────────────────────────────────
  createExercise(dto: Partial<TpExercise>) {
    return this.exercises.save(this.exercises.create(dto));
  }
  listExercises(filters: { teamId?: string; category?: ExerciseCategory; search?: string } = {}) {
    const qb = this.exercises.createQueryBuilder('e');
    if (filters.teamId) qb.andWhere('(e.teamId = :t OR e.teamId IS NULL)', { t: filters.teamId });
    if (filters.category) qb.andWhere('e.category = :c', { c: filters.category });
    if (filters.search) qb.andWhere('(e.name ILIKE :s OR e.description ILIKE :s)', { s: `%${filters.search}%` });
    return qb.orderBy('e.name', 'ASC').getMany();
  }
  async removeExercise(id: string) {
    const res = await this.exercises.delete(id);
    if (!res.affected) throw new NotFoundException(`Exercise ${id} not found`);
  }

  // ─── Attendance ─────────────────────────────────────────────────────────────
  async setAttendance(sessionId: string, entries: { goalkeeperId: string; status: AttendanceStatus }[]) {
    for (const e of entries) {
      const existing = await this.attendance.findOne({ where: { sessionId, goalkeeperId: e.goalkeeperId } });
      if (existing) { existing.status = e.status; await this.attendance.save(existing); }
      else await this.attendance.save(this.attendance.create({ sessionId, ...e }));
    }
    return this.attendance.find({ where: { sessionId } });
  }

  // ─── RPE + internal load ────────────────────────────────────────────────────
  async setRpe(sessionId: string, goalkeeperId: string, value: number, comment?: string) {
    const session = await this.sessions.findOne({ where: { id: sessionId } });
    const durationMinutes = session?.durationMinutes ?? null;
    const workload = durationMinutes != null ? durationMinutes * value : null;
    const existing = await this.rpe.findOne({ where: { sessionId, goalkeeperId } });
    if (existing) {
      Object.assign(existing, { value, comment, durationMinutes, workload });
      return this.rpe.save(existing);
    }
    return this.rpe.save(this.rpe.create({ sessionId, goalkeeperId, value, comment, durationMinutes, workload }));
  }

  // ─── Evaluation ─────────────────────────────────────────────────────────────
  async setEvaluation(sessionId: string, dto: Partial<TpEvaluation> & { goalkeeperId: string }) {
    const existing = await this.evals.findOne({ where: { sessionId, goalkeeperId: dto.goalkeeperId } });
    if (existing) { Object.assign(existing, dto); return this.evals.save(existing); }
    return this.evals.save(this.evals.create({ sessionId, ...dto }));
  }

  // ─── Goals ──────────────────────────────────────────────────────────────────
  createGoal(dto: Partial<TpGoal>) { return this.goals.save(this.goals.create(dto)); }
  listGoals(goalkeeperId: string) { return this.goals.find({ where: { goalkeeperId }, order: { createdAt: 'DESC' } }); }
  async updateGoal(id: string, dto: Partial<TpGoal>) {
    const g = await this.goals.findOne({ where: { id } });
    if (!g) throw new NotFoundException(`Goal ${id} not found`);
    Object.assign(g, dto);
    return this.goals.save(g);
  }
  async removeGoal(id: string) {
    const res = await this.goals.delete(id);
    if (!res.affected) throw new NotFoundException(`Goal ${id} not found`);
  }

  // ─── Dashboard (team) ───────────────────────────────────────────────────────
  async dashboard(teamId?: string) {
    const where: any = {};
    if (teamId) where.teamId = teamId;
    const all = await this.sessions.find({ where, order: { date: 'DESC' } });
    const today = all[0]?.date; // note: uses stored dates, no server clock dependency
    const finished = all.filter((s) => s.status === SessionStatus.FINISHED);
    const upcoming = all.filter((s) => s.status === SessionStatus.SCHEDULED)
      .sort((a, b) => a.date.localeCompare(b.date));
    const ids = all.map((s) => s.id);

    const [rpeRows, attRows, evalRows] = ids.length
      ? await Promise.all([
          this.rpe.find({ where: { sessionId: In(ids) } }),
          this.attendance.find({ where: { sessionId: In(ids) } }),
          this.evals.find({ where: { sessionId: In(ids) } }),
        ])
      : [[], [], []];

    const presentCount = attRows.filter((a) => a.status === AttendanceStatus.PRESENT || a.status === AttendanceStatus.PARTIAL).length;
    const attendanceRate = attRows.length ? +(presentCount / attRows.length * 100).toFixed(1) : 0;
    const evalScores = evalRows.map((e) => avg([avgOfMap(e.technical), avgOfMap(e.physical), avgOfMap(e.mental)].filter(Boolean)));
    const weeklyWorkload = rpeRows.reduce((sum, r) => sum + (r.workload || 0), 0);

    return {
      totalSessions: all.length,
      finishedSessions: finished.length,
      nextSession: upcoming[0] || null,
      lastSession: finished[0] || all.find((s) => s.status === SessionStatus.ONGOING) || all[0] || null,
      attendanceRate,
      avgEvaluation: avg(evalScores.filter(Boolean)),
      avgRpe: avg(rpeRows.map((r) => r.value)),
      weeklyWorkload,
    };
  }

  // ─── Goalkeeper training summary ────────────────────────────────────────────
  async goalkeeperSummary(goalkeeperId: string) {
    const [att, rpeRows, evalRows, goals] = await Promise.all([
      this.attendance.find({ where: { goalkeeperId } }),
      this.rpe.find({ where: { goalkeeperId }, order: { createdAt: 'DESC' } }),
      this.evals.find({ where: { goalkeeperId }, order: { createdAt: 'DESC' } }),
      this.goals.find({ where: { goalkeeperId } }),
    ]);
    const present = att.filter((a) => a.status === AttendanceStatus.PRESENT || a.status === AttendanceStatus.PARTIAL).length;
    return {
      trainings: att.length,
      attendanceRate: att.length ? +(present / att.length * 100).toFixed(1) : 0,
      avgTechnical: avg(evalRows.map((e) => avgOfMap(e.technical)).filter(Boolean)),
      avgPhysical: avg(evalRows.map((e) => avgOfMap(e.physical)).filter(Boolean)),
      avgMental: avg(evalRows.map((e) => avgOfMap(e.mental)).filter(Boolean)),
      avgRpe: avg(rpeRows.map((r) => r.value)),
      accumulatedWorkload: rpeRows.reduce((s, r) => s + (r.workload || 0), 0),
      activeGoals: goals.filter((g) => g.status === GoalStatus.ACTIVE).length,
      goals,
      recentRpe: rpeRows.slice(0, 10),
      recentEvaluations: evalRows.slice(0, 10),
    };
  }
}
