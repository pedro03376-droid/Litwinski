import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { TrainingSession, TrainingCategory, TrainingIntensity } from './entities/training-session.entity';
import { Exercise } from './entities/exercise.entity';
import { ExerciseResult } from './entities/exercise-result.entity';
import { CreateTrainingSessionDto } from './dto/create-training-session.dto';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { CreateExerciseResultDto } from './dto/create-exercise-result.dto';

export interface TrainingFilters {
  category?: TrainingCategory;
  intensity?: TrainingIntensity;
  season?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TrainingStats {
  totalSessions: number;
  totalHours: number;
  averageSuccessRate: number;
  categoryBreakdown: Record<string, number>;
  intensityBreakdown: Record<string, number>;
  totalExercises: number;
  totalAttempts: number;
  totalSuccesses: number;
  overallSuccessPercentage: number;
}

@Injectable()
export class TrainingService {
  constructor(
    @InjectRepository(TrainingSession)
    private readonly sessionRepository: Repository<TrainingSession>,
    @InjectRepository(Exercise)
    private readonly exerciseRepository: Repository<Exercise>,
    @InjectRepository(ExerciseResult)
    private readonly resultRepository: Repository<ExerciseResult>,
  ) {}

  // ─── helpers ──────────────────────────────────────────────────────────────

  private applyFilters(
    qb: SelectQueryBuilder<TrainingSession>,
    filters: TrainingFilters,
  ): void {
    if (filters.category) {
      qb.andWhere('session.category = :category', { category: filters.category });
    }
    if (filters.intensity) {
      qb.andWhere('session.intensity = :intensity', { intensity: filters.intensity });
    }
    if (filters.season) {
      qb.andWhere('session.season = :season', { season: filters.season });
    }
    if (filters.dateFrom) {
      qb.andWhere('session.date >= :dateFrom', { dateFrom: filters.dateFrom });
    }
    if (filters.dateTo) {
      qb.andWhere('session.date <= :dateTo', { dateTo: filters.dateTo });
    }
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  async findAll(
    goalkeeperId?: string,
    filters: TrainingFilters = {},
    pagination: PaginationOptions = {},
  ): Promise<PaginatedResult<TrainingSession>> {
    const { page = 1, limit = 20 } = pagination;

    if (page < 1) throw new BadRequestException('Page must be >= 1');
    if (limit < 1 || limit > 100) throw new BadRequestException('Limit must be between 1 and 100');

    const qb = this.sessionRepository
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.exercises', 'exercises')
      .orderBy('session.date', 'DESC');

    if (goalkeeperId) {
      qb.andWhere('session.goalkeeperId = :goalkeeperId', { goalkeeperId });
    }

    this.applyFilters(qb, filters);

    const total = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<TrainingSession> {
    const session = await this.sessionRepository.findOne({
      where: { id },
      relations: [
        'exercises',
        'exercises.result',
        'goalkeeper',
        'goalkeeper.team',
        'aiAnalyses',
      ],
    });

    if (!session) {
      throw new NotFoundException(`Training session "${id}" not found`);
    }
    return session;
  }

  async create(dto: CreateTrainingSessionDto): Promise<TrainingSession> {
    const session = this.sessionRepository.create({
      ...dto,
      date: new Date(dto.date),
    });
    return this.sessionRepository.save(session);
  }

  async update(id: string, dto: Partial<CreateTrainingSessionDto>): Promise<TrainingSession> {
    const session = await this.findOne(id);
    const updated = this.sessionRepository.merge(session, {
      ...dto,
      date: dto.date ? new Date(dto.date) : session.date,
    });
    return this.sessionRepository.save(updated);
  }

  async remove(id: string): Promise<void> {
    const session = await this.findOne(id);
    await this.sessionRepository.remove(session);
  }

  // ─── Exercises ────────────────────────────────────────────────────────────

  async addExercise(sessionId: string, dto: CreateExerciseDto): Promise<Exercise> {
    // Verify session exists
    await this.findOne(sessionId);

    const exercise = this.exerciseRepository.create({
      ...dto,
      trainingSessionId: sessionId,
    });
    return this.exerciseRepository.save(exercise);
  }

  async updateExercise(exerciseId: string, dto: Partial<CreateExerciseDto>): Promise<Exercise> {
    const exercise = await this.exerciseRepository.findOne({
      where: { id: exerciseId },
      relations: ['result'],
    });

    if (!exercise) {
      throw new NotFoundException(`Exercise "${exerciseId}" not found`);
    }

    this.exerciseRepository.merge(exercise, dto);
    return this.exerciseRepository.save(exercise);
  }

  // ─── Exercise Results ─────────────────────────────────────────────────────

  async addExerciseResult(
    exerciseId: string,
    dto: CreateExerciseResultDto,
  ): Promise<ExerciseResult> {
    const exercise = await this.exerciseRepository.findOne({
      where: { id: exerciseId },
      relations: ['result'],
    });

    if (!exercise) {
      throw new NotFoundException(`Exercise "${exerciseId}" not found`);
    }

    // Calculate success percentage if not provided
    const successPercentage =
      dto.successPercentage !== undefined
        ? dto.successPercentage
        : dto.attempts > 0
        ? Math.round((dto.successes / dto.attempts) * 10000) / 100
        : 0;

    // Upsert: update existing result or create new one
    if (exercise.result) {
      this.resultRepository.merge(exercise.result, { ...dto, successPercentage });
      return this.resultRepository.save(exercise.result);
    }

    const result = this.resultRepository.create({
      ...dto,
      successPercentage,
      exerciseId,
    });
    return this.resultRepository.save(result);
  }

  // ─── Aggregated Training Stats ────────────────────────────────────────────

  async getTrainingStats(goalkeeperId: string): Promise<TrainingStats> {
    const sessions = await this.sessionRepository.find({
      where: { goalkeeperId },
      relations: ['exercises', 'exercises.result'],
    });

    const totalSessions = sessions.length;
    const totalMinutes = sessions.reduce(
      (sum, s) => sum + (s.durationMinutes ?? 0),
      0,
    );
    const totalHours = Math.round((totalMinutes / 60) * 100) / 100;

    // Category breakdown
    const categoryBreakdown: Record<string, number> = {};
    for (const cat of Object.values(TrainingCategory)) {
      categoryBreakdown[cat] = 0;
    }

    // Intensity breakdown
    const intensityBreakdown: Record<string, number> = {};
    for (const int of Object.values(TrainingIntensity)) {
      intensityBreakdown[int] = 0;
    }

    let totalExercises = 0;
    let totalAttempts = 0;
    let totalSuccesses = 0;

    for (const session of sessions) {
      categoryBreakdown[session.category] =
        (categoryBreakdown[session.category] ?? 0) + 1;
      intensityBreakdown[session.intensity] =
        (intensityBreakdown[session.intensity] ?? 0) + 1;

      for (const exercise of session.exercises ?? []) {
        totalExercises++;
        if (exercise.result) {
          totalAttempts += exercise.result.attempts ?? 0;
          totalSuccesses += exercise.result.successes ?? 0;
        }
      }
    }

    const overallSuccessPercentage =
      totalAttempts > 0
        ? Math.round((totalSuccesses / totalAttempts) * 10000) / 100
        : 0;

    // Average success rate per session
    const sessionsWithResults = sessions.filter(
      (s) =>
        s.exercises?.some(
          (e) => e.result && (e.result.attempts ?? 0) > 0,
        ),
    );

    let sessionSuccessSum = 0;
    for (const session of sessionsWithResults) {
      let sessionAttempts = 0;
      let sessionSuccesses = 0;
      for (const exercise of session.exercises ?? []) {
        if (exercise.result) {
          sessionAttempts += exercise.result.attempts ?? 0;
          sessionSuccesses += exercise.result.successes ?? 0;
        }
      }
      if (sessionAttempts > 0) {
        sessionSuccessSum += sessionSuccesses / sessionAttempts;
      }
    }

    const averageSuccessRate =
      sessionsWithResults.length > 0
        ? Math.round((sessionSuccessSum / sessionsWithResults.length) * 10000) / 100
        : 0;

    return {
      totalSessions,
      totalHours,
      averageSuccessRate,
      categoryBreakdown,
      intensityBreakdown,
      totalExercises,
      totalAttempts,
      totalSuccesses,
      overallSuccessPercentage,
    };
  }
}
