import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsEnum,
  IsDateString,
  IsNumber,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Goalkeeper, DominantHand, DominantFoot } from './entities/goalkeeper.entity';
import { Match } from '../matches/entities/match.entity';
import { TrainingSession } from '../training/entities/training-session.entity';
import { PerformanceIndex, PerformanceSource } from '../performance/entities/performance-index.entity';

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export class CreateGoalkeeperDto {
  @ApiProperty({ example: 'Lucas Ferreira' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: '2005-03-15', description: 'Birth date (YYYY-MM-DD)' })
  @IsDateString()
  birthDate: string;

  @ApiProperty({ example: 'Sub-17', description: 'Category (e.g. Sub-17, Professional)' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  category: string;

  @ApiPropertyOptional({ example: 'team-uuid' })
  @IsOptional()
  @IsString()
  teamId?: string;

  @ApiPropertyOptional({ example: 185.5 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(100)
  @Max(230)
  height?: number;

  @ApiPropertyOptional({ example: 78.0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(30)
  @Max(200)
  weight?: number;

  @ApiPropertyOptional({ enum: DominantHand, default: DominantHand.RIGHT })
  @IsOptional()
  @IsEnum(DominantHand)
  dominantHand?: DominantHand;

  @ApiPropertyOptional({ enum: DominantFoot, default: DominantFoot.RIGHT })
  @IsOptional()
  @IsEnum(DominantFoot)
  dominantFoot?: DominantFoot;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  jerseyNumber?: number;

  @ApiPropertyOptional({ example: 'Brazilian' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  nationality?: string;

  @ApiPropertyOptional({ description: 'Additional observations or notes' })
  @IsOptional()
  @IsString()
  observations?: string;

  @ApiPropertyOptional({ description: 'URL or path to goalkeeper photo' })
  @IsOptional()
  @IsString()
  photo?: string;
}

export class UpdateGoalkeeperDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(100) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() birthDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(50) category?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() teamId?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(100) @Max(230) height?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(30) @Max(200) weight?: number;
  @ApiPropertyOptional({ enum: DominantHand }) @IsOptional() @IsEnum(DominantHand) dominantHand?: DominantHand;
  @ApiPropertyOptional({ enum: DominantFoot }) @IsOptional() @IsEnum(DominantFoot) dominantFoot?: DominantFoot;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(99) jerseyNumber?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) nationality?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() observations?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() photo?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class PaginatedGoalkeepers {
  data: Goalkeeper[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface GoalkeeperQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  teamId?: string;
  category?: string;
  isActive?: boolean;
}

export type EvolutionPeriod = 'weekly' | 'monthly' | 'yearly';

export interface EvolutionDataPoint {
  period: string;
  overallScore: number;
  reflexScore: number;
  positioningScore: number;
  highSaveScore: number;
  lowSaveScore: number;
  distributionScore: number;
  footworkScore: number;
  goalExitScore: number;
  decisionMakingScore: number;
  interceptionScore: number;
  matchCount: number;
  trainingCount: number;
}

export interface GoalkeeperStatsSummary {
  goalkeeper: {
    id: string;
    name: string;
    category: string;
    age: number;
  };
  matches: {
    total: number;
    wins: number;
    draws: number;
    losses: number;
    goalsConceded: number;
    goalsScored: number;
    cleanSheets: number;
    saveRate: number;
  };
  training: {
    total: number;
    totalMinutes: number;
    averageDurationMinutes: number;
    byCategory: Record<string, number>;
  };
  performance: {
    averageOverallScore: number;
    averageReflexScore: number;
    averagePositioningScore: number;
    averageHighSaveScore: number;
    averageLowSaveScore: number;
    averageDistributionScore: number;
    averageFootworkScore: number;
    averageGoalExitScore: number;
    averageDecisionMakingScore: number;
    averageInterceptionScore: number;
    lastPerformanceDate: Date | null;
    totalIndexes: number;
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class GoalkeepersService {
  constructor(
    @InjectRepository(Goalkeeper)
    private readonly goalkeeperRepository: Repository<Goalkeeper>,

    @InjectRepository(Match)
    private readonly matchRepository: Repository<Match>,

    @InjectRepository(TrainingSession)
    private readonly trainingRepository: Repository<TrainingSession>,

    @InjectRepository(PerformanceIndex)
    private readonly performanceRepository: Repository<PerformanceIndex>,
  ) {}

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  /**
   * Returns a paginated list of goalkeepers with optional filtering.
   */
  async findAll(params: GoalkeeperQueryParams = {}): Promise<PaginatedGoalkeepers> {
    const {
      page = 1,
      limit = 20,
      search,
      teamId,
      category,
      isActive,
    } = params;

    if (page < 1 || limit < 1 || limit > 100) {
      throw new BadRequestException('page must be >= 1 and limit must be between 1 and 100');
    }

    const qb = this.goalkeeperRepository
      .createQueryBuilder('gk')
      .leftJoinAndSelect('gk.team', 'team');

    if (search) {
      qb.andWhere(
        '(gk.name ILIKE :search OR gk.nationality ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (teamId) {
      qb.andWhere('gk.teamId = :teamId', { teamId });
    }

    if (category) {
      qb.andWhere('gk.category ILIKE :category', { category: `%${category}%` });
    }

    if (isActive !== undefined) {
      qb.andWhere('gk.isActive = :isActive', { isActive });
    }

    const [data, total] = await qb
      .orderBy('gk.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Finds a single goalkeeper by ID.
   */
  async findOne(id: string): Promise<Goalkeeper> {
    const goalkeeper = await this.goalkeeperRepository.findOne({
      where: { id },
      relations: ['team'],
    });

    if (!goalkeeper) {
      throw new NotFoundException(`Goalkeeper with ID "${id}" not found`);
    }

    return goalkeeper;
  }

  /**
   * Creates a new goalkeeper profile.
   */
  async create(dto: CreateGoalkeeperDto): Promise<Goalkeeper> {
    const goalkeeper = this.goalkeeperRepository.create({
      ...dto,
      name: dto.name.trim(),
      birthDate: new Date(dto.birthDate),
      dominantHand: dto.dominantHand ?? DominantHand.RIGHT,
      dominantFoot: dto.dominantFoot ?? DominantFoot.RIGHT,
      isActive: true,
    });

    return this.goalkeeperRepository.save(goalkeeper);
  }

  /**
   * Updates an existing goalkeeper's data.
   */
  async update(id: string, dto: UpdateGoalkeeperDto): Promise<Goalkeeper> {
    await this.findOne(id); // ensure existence

    const updates: Partial<Goalkeeper> = {
      ...(dto.name !== undefined && { name: dto.name.trim() }),
      ...(dto.birthDate !== undefined && { birthDate: new Date(dto.birthDate) }),
      ...(dto.category !== undefined && { category: dto.category.trim() }),
      ...(dto.teamId !== undefined && { teamId: dto.teamId }),
      ...(dto.height !== undefined && { height: dto.height }),
      ...(dto.weight !== undefined && { weight: dto.weight }),
      ...(dto.dominantHand !== undefined && { dominantHand: dto.dominantHand }),
      ...(dto.dominantFoot !== undefined && { dominantFoot: dto.dominantFoot }),
      ...(dto.jerseyNumber !== undefined && { jerseyNumber: dto.jerseyNumber }),
      ...(dto.nationality !== undefined && { nationality: dto.nationality }),
      ...(dto.observations !== undefined && { observations: dto.observations }),
      ...(dto.photo !== undefined && { photo: dto.photo }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    };

    await this.goalkeeperRepository.update(id, updates);
    return this.findOne(id);
  }

  /**
   * Soft-deletes a goalkeeper by marking them inactive.
   */
  async remove(id: string): Promise<{ message: string }> {
    const goalkeeper = await this.findOne(id);
    await this.goalkeeperRepository.update(id, { isActive: false });
    return { message: `Goalkeeper "${goalkeeper.name}" has been deactivated` };
  }

  // ─── Stats & Analytics ────────────────────────────────────────────────────

  /**
   * Returns a comprehensive statistics summary for a goalkeeper:
   * match results, training totals, and averaged performance scores.
   */
  async getStatsSummary(id: string): Promise<GoalkeeperStatsSummary> {
    const goalkeeper = await this.findOne(id);

    // ── Match stats ──────────────────────────────────────────────────────────
    const matches = await this.matchRepository.find({
      where: { goalkeeperId: id },
      relations: ['scouts'],
      order: { date: 'DESC' },
    });

    const wins = matches.filter((m) => m.result === 'win').length;
    const draws = matches.filter((m) => m.result === 'draw').length;
    const losses = matches.filter((m) => m.result === 'loss').length;
    const goalsConceded = matches.reduce((sum, m) => sum + (m.goalsConceded ?? 0), 0);
    const goalsScored = matches.reduce((sum, m) => sum + (m.goalsScored ?? 0), 0);
    const cleanSheets = matches.filter((m) => (m.goalsConceded ?? 0) === 0).length;

    // Save rate: saves / (saves + goals conceded), derived from scout data
    let totalSaves = 0;
    let totalGoalsConcededFromScouts = 0;
    for (const match of matches) {
      for (const scout of match.scouts ?? []) {
        totalSaves += scout.totalSaves ?? 0;
        totalGoalsConcededFromScouts += scout.totalGoalsConceded ?? 0;
      }
    }
    const totalShots = totalSaves + totalGoalsConcededFromScouts;
    const saveRate = totalShots > 0
      ? Math.round((totalSaves / totalShots) * 10000) / 100
      : 0;

    // ── Training stats ───────────────────────────────────────────────────────
    const trainingSessions = await this.trainingRepository.find({
      where: { goalkeeperId: id },
      order: { date: 'DESC' },
    });

    const totalMinutes = trainingSessions.reduce(
      (sum, ts) => sum + (ts.durationMinutes ?? 0),
      0,
    );
    const averageDurationMinutes = trainingSessions.length > 0
      ? Math.round(totalMinutes / trainingSessions.length)
      : 0;

    const byCategory = trainingSessions.reduce<Record<string, number>>((acc, ts) => {
      acc[ts.category] = (acc[ts.category] ?? 0) + 1;
      return acc;
    }, {});

    // ── Performance index stats ──────────────────────────────────────────────
    const performanceIndexes = await this.performanceRepository.find({
      where: { goalkeeperId: id },
      order: { date: 'DESC' },
    });

    const perfCount = performanceIndexes.length;

    const avgOrZero = (field: keyof PerformanceIndex): number => {
      if (perfCount === 0) return 0;
      const sum = performanceIndexes.reduce(
        (acc, pi) => acc + Number(pi[field] ?? 0),
        0,
      );
      return Math.round((sum / perfCount) * 100) / 100;
    };

    return {
      goalkeeper: {
        id: goalkeeper.id,
        name: goalkeeper.name,
        category: goalkeeper.category,
        age: goalkeeper.age,
      },
      matches: {
        total: matches.length,
        wins,
        draws,
        losses,
        goalsConceded,
        goalsScored,
        cleanSheets,
        saveRate,
      },
      training: {
        total: trainingSessions.length,
        totalMinutes,
        averageDurationMinutes,
        byCategory,
      },
      performance: {
        averageOverallScore: avgOrZero('overallScore'),
        averageReflexScore: avgOrZero('reflexScore'),
        averagePositioningScore: avgOrZero('positioningScore'),
        averageHighSaveScore: avgOrZero('highSaveScore'),
        averageLowSaveScore: avgOrZero('lowSaveScore'),
        averageDistributionScore: avgOrZero('distributionScore'),
        averageFootworkScore: avgOrZero('footworkScore'),
        averageGoalExitScore: avgOrZero('goalExitScore'),
        averageDecisionMakingScore: avgOrZero('decisionMakingScore'),
        averageInterceptionScore: avgOrZero('interceptionScore'),
        lastPerformanceDate: performanceIndexes[0]?.date ?? null,
        totalIndexes: perfCount,
      },
    };
  }

  /**
   * Returns time-series evolution data for a goalkeeper's performance.
   * Aggregates PerformanceIndex records by week / month / year.
   */
  async getEvolution(
    id: string,
    period: EvolutionPeriod = 'monthly',
  ): Promise<EvolutionDataPoint[]> {
    await this.findOne(id); // ensure goalkeeper exists

    const validPeriods: EvolutionPeriod[] = ['weekly', 'monthly', 'yearly'];
    if (!validPeriods.includes(period)) {
      throw new BadRequestException(`period must be one of: ${validPeriods.join(', ')}`);
    }

    // Determine the date format for grouping
    const dateFormat = period === 'weekly'
      ? 'IYYY-IW'          // ISO year + ISO week number
      : period === 'monthly'
        ? 'YYYY-MM'
        : 'YYYY';

    // Raw aggregate query using TypeORM query builder
    const rows = await this.performanceRepository
      .createQueryBuilder('pi')
      .select(`TO_CHAR(pi.date, '${dateFormat}')`, 'period')
      .addSelect('AVG(pi.overallScore)', 'overallScore')
      .addSelect('AVG(pi.reflexScore)', 'reflexScore')
      .addSelect('AVG(pi.positioningScore)', 'positioningScore')
      .addSelect('AVG(pi.highSaveScore)', 'highSaveScore')
      .addSelect('AVG(pi.lowSaveScore)', 'lowSaveScore')
      .addSelect('AVG(pi.distributionScore)', 'distributionScore')
      .addSelect('AVG(pi.footworkScore)', 'footworkScore')
      .addSelect('AVG(pi.goalExitScore)', 'goalExitScore')
      .addSelect('AVG(pi.decisionMakingScore)', 'decisionMakingScore')
      .addSelect('AVG(pi.interceptionScore)', 'interceptionScore')
      .addSelect(`COUNT(*) FILTER (WHERE pi.source = '${PerformanceSource.MATCH}')`, 'matchCount')
      .addSelect(`COUNT(*) FILTER (WHERE pi.source = '${PerformanceSource.TRAINING}')`, 'trainingCount')
      .where('pi.goalkeeperId = :id', { id })
      .groupBy(`TO_CHAR(pi.date, '${dateFormat}')`)
      .orderBy(`TO_CHAR(pi.date, '${dateFormat}')`, 'ASC')
      .getRawMany<{
        period: string;
        overallScore: string;
        reflexScore: string;
        positioningScore: string;
        highSaveScore: string;
        lowSaveScore: string;
        distributionScore: string;
        footworkScore: string;
        goalExitScore: string;
        decisionMakingScore: string;
        interceptionScore: string;
        matchCount: string;
        trainingCount: string;
      }>();

    return rows.map((row) => ({
      period: row.period,
      overallScore: this._round(row.overallScore),
      reflexScore: this._round(row.reflexScore),
      positioningScore: this._round(row.positioningScore),
      highSaveScore: this._round(row.highSaveScore),
      lowSaveScore: this._round(row.lowSaveScore),
      distributionScore: this._round(row.distributionScore),
      footworkScore: this._round(row.footworkScore),
      goalExitScore: this._round(row.goalExitScore),
      decisionMakingScore: this._round(row.decisionMakingScore),
      interceptionScore: this._round(row.interceptionScore),
      matchCount: parseInt(row.matchCount, 10),
      trainingCount: parseInt(row.trainingCount, 10),
    }));
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private _round(value: string | number | null | undefined): number {
    if (value === null || value === undefined) return 0;
    return Math.round(Number(value) * 100) / 100;
  }
}
