import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import {
  PerformanceIndex,
  PerformanceClassification,
  PerformanceSource,
} from './entities/performance-index.entity';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface ScoutDataInput {
  highSaveRight?: number;
  highSaveLeft?: number;
  lowSaveRight?: number;
  lowSaveLeft?: number;
  centralSave?: number;
  interceptions?: number;
  clearances?: number;
  launchRightFoot?: number;
  launchLeftFoot?: number;
  launchRightHand?: number;
  positionBaseLeft?: number;
  positionBaseRight?: number;
  goalOutsideArea?: number;
  goalInsideArea?: number;
  matchDate?: Date;
  matchId?: string;
  goalkeeperId?: string;
  season?: string;
}

export interface ExerciseResultInput {
  category?: string;
  attempts?: number;
  successes?: number;
  reactionTimeSeconds?: number;
}

export interface PerformanceFilters {
  source?: PerformanceSource;
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

export interface ChartPoint {
  period: string;
  overallScore: number;
  highSaveScore: number;
  lowSaveScore: number;
  interceptionScore: number;
  distributionScore: number;
  positioningScore: number;
  count: number;
}

export interface EvolutionChartData {
  period: 'weekly' | 'monthly' | 'yearly';
  data: ChartPoint[];
}

export interface RankingEntry {
  goalkeeperId: string;
  overallScore: number;
  classification: PerformanceClassification | null;
  totalEvaluations: number;
}

export interface ComparisonData {
  goalkeeperId: string;
  averageScores: {
    overallScore: number;
    highSaveScore: number;
    lowSaveScore: number;
    interceptionScore: number;
    distributionScore: number;
    positioningScore: number;
    reflexScore: number;
    footworkScore: number;
    goalExitScore: number;
    decisionMakingScore: number;
  };
  totalEvaluations: number;
  classification: PerformanceClassification | null;
}

// ─── Scoring constants ────────────────────────────────────────────────────────

// Assumed "max" benchmark values per match (normalisation denominators)
const MAX_HIGH_SAVES = 10;
const MAX_LOW_SAVES = 10;
const MAX_INTERCEPTIONS = 8;
const MAX_POSITIONING = 10;

// Score weights for overall calculation
const SCORE_WEIGHTS = {
  highSaveScore: 0.20,
  lowSaveScore: 0.20,
  interceptionScore: 0.15,
  distributionScore: 0.15,
  positioningScore: 0.15,
  reflexScore: 0.05,
  footworkScore: 0.05,
  goalExitScore: 0.03,
  decisionMakingScore: 0.02,
};

// ─── Helper ───────────────────────────────────────────────────────────────────

function clamp(value: number, min = 0, max = 10): number {
  return Math.min(max, Math.max(min, value));
}

function classify(score: number): PerformanceClassification {
  if (score >= 9) return PerformanceClassification.ELITE;
  if (score >= 8) return PerformanceClassification.EXCELLENT;
  if (score >= 7) return PerformanceClassification.GOOD;
  if (score >= 5) return PerformanceClassification.REGULAR;
  return PerformanceClassification.DEVELOPING;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

@Injectable()
export class PerformanceService {
  constructor(
    @InjectRepository(PerformanceIndex)
    private readonly performanceRepository: Repository<PerformanceIndex>,
  ) {}

  // ─── Score calculation ────────────────────────────────────────────────────

  private computeScoresFromScout(data: ScoutDataInput): Partial<PerformanceIndex> {
    const highSaveRight = data.highSaveRight ?? 0;
    const highSaveLeft = data.highSaveLeft ?? 0;
    const lowSaveRight = data.lowSaveRight ?? 0;
    const lowSaveLeft = data.lowSaveLeft ?? 0;
    const centralSave = data.centralSave ?? 0;
    const interceptions = data.interceptions ?? 0;
    const clearances = data.clearances ?? 0;
    const launchRightFoot = data.launchRightFoot ?? 0;
    const launchLeftFoot = data.launchLeftFoot ?? 0;
    const launchRightHand = data.launchRightHand ?? 0;
    const positionBaseLeft = data.positionBaseLeft ?? 0;
    const positionBaseRight = data.positionBaseRight ?? 0;
    const goalOutsideArea = data.goalOutsideArea ?? 0;
    const goalInsideArea = data.goalInsideArea ?? 0;

    // High saves score (0–10)
    const highSaveScore = clamp(
      ((highSaveRight + highSaveLeft) / MAX_HIGH_SAVES) * 10,
    );

    // Low saves score (0–10)
    const lowSaveScore = clamp(
      ((lowSaveRight + lowSaveLeft) / MAX_LOW_SAVES) * 10,
    );

    // Interception score (0–10)
    const interceptionScore = clamp(
      (interceptions / MAX_INTERCEPTIONS) * 10,
    );

    // Distribution score (0–10): proportion of dominant-side launches
    const totalLaunches = launchRightFoot + launchLeftFoot + launchRightHand;
    const dominantLaunches = launchRightFoot + launchRightHand;
    const distributionScore = clamp(
      totalLaunches > 0 ? (dominantLaunches / totalLaunches) * 10 : 0,
    );

    // Positioning score (0–10): average of positioning base metrics
    const positioningScore = clamp(
      ((positionBaseLeft + positionBaseRight) / 2 / MAX_POSITIONING) * 10,
    );

    // Reflex score derived from central saves + save reaction proxy
    const totalSaves = highSaveRight + highSaveLeft + lowSaveRight + lowSaveLeft + centralSave;
    const totalGoalsConceded = goalOutsideArea + goalInsideArea;
    const totalShots = totalSaves + totalGoalsConceded;
    const reflexScore = clamp(
      totalShots > 0 ? (totalSaves / totalShots) * 10 : 5,
    );

    // Footwork: proxy via clearances
    const footworkScore = clamp(
      (clearances / Math.max(clearances + 2, 1)) * 10,
    );

    // Goal exit: penalise goals conceded outside area (poor decision to stay)
    const goalExitScore = clamp(
      goalOutsideArea === 0 ? 10 : Math.max(0, 10 - goalOutsideArea * 2),
    );

    // Decision making: blend of interception and distribution execution
    const decisionMakingScore = clamp(
      (interceptionScore * 0.6 + distributionScore * 0.4),
    );

    // Overall: weighted average
    const overallScore = clamp(
      SCORE_WEIGHTS.highSaveScore * highSaveScore +
      SCORE_WEIGHTS.lowSaveScore * lowSaveScore +
      SCORE_WEIGHTS.interceptionScore * interceptionScore +
      SCORE_WEIGHTS.distributionScore * distributionScore +
      SCORE_WEIGHTS.positioningScore * positioningScore +
      SCORE_WEIGHTS.reflexScore * reflexScore +
      SCORE_WEIGHTS.footworkScore * footworkScore +
      SCORE_WEIGHTS.goalExitScore * goalExitScore +
      SCORE_WEIGHTS.decisionMakingScore * decisionMakingScore,
    );

    const classification = classify(overallScore);

    return {
      highSaveScore: round2(highSaveScore),
      lowSaveScore: round2(lowSaveScore),
      interceptionScore: round2(interceptionScore),
      distributionScore: round2(distributionScore),
      positioningScore: round2(positioningScore),
      reflexScore: round2(reflexScore),
      footworkScore: round2(footworkScore),
      goalExitScore: round2(goalExitScore),
      decisionMakingScore: round2(decisionMakingScore),
      overallScore: round2(overallScore),
      classification,
    };
  }

  private computeScoresFromExercises(
    exercises: ExerciseResultInput[],
  ): Partial<PerformanceIndex> {
    if (exercises.length === 0) {
      return {
        overallScore: 0,
        classification: PerformanceClassification.DEVELOPING,
      };
    }

    let totalAttempts = 0;
    let totalSuccesses = 0;
    let reactionTimeSum = 0;
    let reactionTimeCount = 0;

    for (const ex of exercises) {
      totalAttempts += ex.attempts ?? 0;
      totalSuccesses += ex.successes ?? 0;
      if (ex.reactionTimeSeconds !== undefined && ex.reactionTimeSeconds > 0) {
        reactionTimeSum += ex.reactionTimeSeconds;
        reactionTimeCount++;
      }
    }

    const successRate =
      totalAttempts > 0 ? totalSuccesses / totalAttempts : 0;

    // Reflex score: based on reaction time (benchmark <0.3s = 10, >1.0s = 0)
    const avgReactionTime =
      reactionTimeCount > 0 ? reactionTimeSum / reactionTimeCount : 0.5;
    const reflexScore = clamp(
      avgReactionTime > 0
        ? Math.max(0, 10 - (avgReactionTime - 0.3) / 0.07)
        : 5,
    );

    // Most scores come from the success rate
    const successScore = clamp(successRate * 10);

    const overallScore = clamp(successScore * 0.75 + reflexScore * 0.25);
    const classification = classify(overallScore);

    return {
      reflexScore: round2(reflexScore),
      highSaveScore: round2(successScore),
      lowSaveScore: round2(successScore),
      interceptionScore: round2(successScore),
      distributionScore: round2(successScore),
      positioningScore: round2(successScore),
      footworkScore: round2(successScore),
      goalExitScore: round2(successScore),
      decisionMakingScore: round2(successScore),
      overallScore: round2(overallScore),
      classification,
    };
  }

  // ─── Calculate from match scout data ─────────────────────────────────────

  async calculateFromMatch(
    matchId: string,
    scoutData: ScoutDataInput,
  ): Promise<PerformanceIndex> {
    if (!scoutData.goalkeeperId) {
      throw new BadRequestException('goalkeeperId is required in scoutData');
    }

    const scores = this.computeScoresFromScout(scoutData);

    // Check if a record for this match already exists and update it
    let existing = await this.performanceRepository.findOne({
      where: { matchId },
    });

    if (existing) {
      this.performanceRepository.merge(existing, scores);
      return this.performanceRepository.save(existing);
    }

    const record = this.performanceRepository.create({
      ...scores,
      goalkeeperId: scoutData.goalkeeperId,
      matchId,
      source: PerformanceSource.MATCH,
      date: scoutData.matchDate ?? new Date(),
      season: scoutData.season,
    });

    return this.performanceRepository.save(record);
  }

  // ─── Calculate from training session ─────────────────────────────────────

  async calculateFromTraining(
    trainingSessionId: string,
    goalkeeperId: string,
    exercises: ExerciseResultInput[],
    date?: Date,
    season?: string,
  ): Promise<PerformanceIndex> {
    const scores = this.computeScoresFromExercises(exercises);

    let existing = await this.performanceRepository.findOne({
      where: { trainingSessionId },
    });

    if (existing) {
      this.performanceRepository.merge(existing, scores);
      return this.performanceRepository.save(existing);
    }

    const record = this.performanceRepository.create({
      ...scores,
      goalkeeperId,
      trainingSessionId,
      source: PerformanceSource.TRAINING,
      date: date ?? new Date(),
      season,
    });

    return this.performanceRepository.save(record);
  }

  // ─── Find by goalkeeper ───────────────────────────────────────────────────

  async findByGoalkeeper(
    goalkeeperId: string,
    filters: PerformanceFilters = {},
    pagination: PaginationOptions = {},
  ): Promise<PaginatedResult<PerformanceIndex>> {
    const { page = 1, limit = 20 } = pagination;

    if (page < 1) throw new BadRequestException('Page must be >= 1');
    if (limit < 1 || limit > 100) throw new BadRequestException('Limit must be between 1 and 100');

    const qb = this.performanceRepository
      .createQueryBuilder('perf')
      .where('perf.goalkeeperId = :goalkeeperId', { goalkeeperId })
      .orderBy('perf.date', 'DESC');

    if (filters.source) {
      qb.andWhere('perf.source = :source', { source: filters.source });
    }
    if (filters.season) {
      qb.andWhere('perf.season = :season', { season: filters.season });
    }
    if (filters.dateFrom) {
      qb.andWhere('perf.date >= :dateFrom', { dateFrom: filters.dateFrom });
    }
    if (filters.dateTo) {
      qb.andWhere('perf.date <= :dateTo', { dateTo: filters.dateTo });
    }

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

  // ─── Evolution chart ──────────────────────────────────────────────────────

  async getEvolutionChart(
    goalkeeperId: string,
    period: 'weekly' | 'monthly' | 'yearly' = 'monthly',
  ): Promise<EvolutionChartData> {
    const records = await this.performanceRepository.find({
      where: { goalkeeperId },
      order: { date: 'ASC' },
    });

    const grouped = new Map<string, PerformanceIndex[]>();

    for (const record of records) {
      const d = new Date(record.date);
      let key: string;

      if (period === 'weekly') {
        // ISO week: YYYY-Www
        const startOfYear = new Date(d.getFullYear(), 0, 1);
        const weekNo = Math.ceil(
          ((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7,
        );
        key = `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
      } else if (period === 'monthly') {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      } else {
        key = `${d.getFullYear()}`;
      }

      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(record);
    }

    const data: ChartPoint[] = [];

    for (const [periodKey, items] of grouped.entries()) {
      const avg = (field: keyof PerformanceIndex) => {
        const values = items.map((i) => Number(i[field]) || 0);
        return round2(values.reduce((a, b) => a + b, 0) / values.length);
      };

      data.push({
        period: periodKey,
        overallScore: avg('overallScore'),
        highSaveScore: avg('highSaveScore'),
        lowSaveScore: avg('lowSaveScore'),
        interceptionScore: avg('interceptionScore'),
        distributionScore: avg('distributionScore'),
        positioningScore: avg('positioningScore'),
        count: items.length,
      });
    }

    return { period, data };
  }

  // ─── Ranking ──────────────────────────────────────────────────────────────

  async getRanking(teamId?: string): Promise<RankingEntry[]> {
    const qb = this.performanceRepository
      .createQueryBuilder('perf')
      .select('perf.goalkeeperId', 'goalkeeperId')
      .addSelect('AVG(perf.overallScore)', 'avgOverall')
      .addSelect('COUNT(perf.id)', 'total')
      .groupBy('perf.goalkeeperId')
      .orderBy('avgOverall', 'DESC');

    if (teamId) {
      // Join goalkeeper to filter by teamId
      qb.innerJoin('goalkeepers', 'gk', 'gk.id = perf.goalkeeperId')
        .andWhere('gk.teamId = :teamId', { teamId });
    }

    const rows = await qb.getRawMany();

    return rows.map((row) => ({
      goalkeeperId: row.goalkeeperId,
      overallScore: round2(parseFloat(row.avgOverall)),
      classification: classify(parseFloat(row.avgOverall)),
      totalEvaluations: parseInt(row.total, 10),
    }));
  }

  // ─── Comparison ───────────────────────────────────────────────────────────

  async getComparison(
    gkId1: string,
    gkId2: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<{ goalkeeper1: ComparisonData; goalkeeper2: ComparisonData }> {
    const buildQuery = (goalkeeperId: string) => {
      const qb = this.performanceRepository
        .createQueryBuilder('perf')
        .where('perf.goalkeeperId = :goalkeeperId', { goalkeeperId });

      if (dateFrom) {
        qb.andWhere('perf.date >= :dateFrom', { dateFrom });
      }
      if (dateTo) {
        qb.andWhere('perf.date <= :dateTo', { dateTo });
      }

      return qb.getMany();
    };

    const [records1, records2] = await Promise.all([
      buildQuery(gkId1),
      buildQuery(gkId2),
    ]);

    const summarise = (
      goalkeeperId: string,
      records: PerformanceIndex[],
    ): ComparisonData => {
      if (records.length === 0) {
        return {
          goalkeeperId,
          averageScores: {
            overallScore: 0,
            highSaveScore: 0,
            lowSaveScore: 0,
            interceptionScore: 0,
            distributionScore: 0,
            positioningScore: 0,
            reflexScore: 0,
            footworkScore: 0,
            goalExitScore: 0,
            decisionMakingScore: 0,
          },
          totalEvaluations: 0,
          classification: null,
        };
      }

      const avg = (field: keyof PerformanceIndex) => {
        const values = records.map((r) => Number(r[field]) || 0);
        return round2(values.reduce((a, b) => a + b, 0) / values.length);
      };

      const overallScore = avg('overallScore');

      return {
        goalkeeperId,
        averageScores: {
          overallScore,
          highSaveScore: avg('highSaveScore'),
          lowSaveScore: avg('lowSaveScore'),
          interceptionScore: avg('interceptionScore'),
          distributionScore: avg('distributionScore'),
          positioningScore: avg('positioningScore'),
          reflexScore: avg('reflexScore'),
          footworkScore: avg('footworkScore'),
          goalExitScore: avg('goalExitScore'),
          decisionMakingScore: avg('decisionMakingScore'),
        },
        totalEvaluations: records.length,
        classification: classify(overallScore),
      };
    };

    return {
      goalkeeper1: summarise(gkId1, records1),
      goalkeeper2: summarise(gkId2, records2),
    };
  }
}
