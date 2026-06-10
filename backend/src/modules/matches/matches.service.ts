import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Match, MatchResult } from './entities/match.entity';
import { CreateMatchDto } from './dto/create-match.dto';

export interface MatchFilters {
  competition?: string;
  result?: MatchResult;
  category?: string;
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

export interface MatchStats {
  totalMatches: number;
  wins: number;
  draws: number;
  losses: number;
  goalsScored: number;
  goalsConceded: number;
  savePercentage: number;
  cleanSheets: number;
  winPercentage: number;
}

@Injectable()
export class MatchesService {
  constructor(
    @InjectRepository(Match)
    private readonly matchRepository: Repository<Match>,
  ) {}

  // ─── helpers ──────────────────────────────────────────────────────────────

  private applyFilters(
    qb: SelectQueryBuilder<Match>,
    filters: MatchFilters,
  ): void {
    if (filters.competition) {
      qb.andWhere('match.competition ILIKE :competition', {
        competition: `%${filters.competition}%`,
      });
    }
    if (filters.result) {
      qb.andWhere('match.result = :result', { result: filters.result });
    }
    if (filters.category) {
      qb.andWhere('match.category ILIKE :category', {
        category: `%${filters.category}%`,
      });
    }
    if (filters.season) {
      qb.andWhere('match.season = :season', { season: filters.season });
    }
    if (filters.dateFrom) {
      qb.andWhere('match.date >= :dateFrom', { dateFrom: filters.dateFrom });
    }
    if (filters.dateTo) {
      qb.andWhere('match.date <= :dateTo', { dateTo: filters.dateTo });
    }
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  async findAll(
    goalkeeperId?: string,
    filters: MatchFilters = {},
    pagination: PaginationOptions = {},
  ): Promise<PaginatedResult<Match>> {
    const { page = 1, limit = 20 } = pagination;

    if (page < 1) throw new BadRequestException('Page must be >= 1');
    if (limit < 1 || limit > 100) throw new BadRequestException('Limit must be between 1 and 100');

    const qb = this.matchRepository
      .createQueryBuilder('match')
      .leftJoinAndSelect('match.scouts', 'scouts')
      .orderBy('match.date', 'DESC');

    if (goalkeeperId) {
      qb.andWhere('match.goalkeeperId = :goalkeeperId', { goalkeeperId });
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

  async findOne(id: string): Promise<Match> {
    const match = await this.matchRepository.findOne({
      where: { id },
      relations: ['scouts', 'goalkeeper', 'goalkeeper.team', 'aiAnalyses'],
    });

    if (!match) throw new NotFoundException(`Match with id "${id}" not found`);
    return match;
  }

  async create(dto: CreateMatchDto): Promise<Match> {
    const match = this.matchRepository.create({
      ...dto,
      date: new Date(dto.date),
      goalsScored: dto.goalsScored ?? 0,
      goalsConceded: dto.goalsConceded ?? 0,
    });
    return this.matchRepository.save(match);
  }

  async update(id: string, dto: Partial<CreateMatchDto>): Promise<Match> {
    const match = await this.findOne(id);

    const updated = this.matchRepository.merge(match, {
      ...dto,
      date: dto.date ? new Date(dto.date) : match.date,
    });

    return this.matchRepository.save(updated);
  }

  async remove(id: string): Promise<void> {
    const match = await this.findOne(id);
    await this.matchRepository.remove(match);
  }

  // ─── Aggregated stats ─────────────────────────────────────────────────────

  async getMatchStats(goalkeeperId: string): Promise<MatchStats> {
    const matches = await this.matchRepository.find({
      where: { goalkeeperId },
      relations: ['scouts'],
    });

    const totalMatches = matches.length;
    const wins = matches.filter((m) => m.result === MatchResult.WIN).length;
    const draws = matches.filter((m) => m.result === MatchResult.DRAW).length;
    const losses = matches.filter((m) => m.result === MatchResult.LOSS).length;

    const goalsScored = matches.reduce((sum, m) => sum + (m.goalsScored ?? 0), 0);
    const goalsConceded = matches.reduce((sum, m) => sum + (m.goalsConceded ?? 0), 0);
    const cleanSheets = matches.filter((m) => (m.goalsConceded ?? 0) === 0).length;

    // Build save percentage from scout data
    let totalSaves = 0;
    let totalGoalsConcededFromScouts = 0;

    for (const match of matches) {
      for (const scout of match.scouts ?? []) {
        const saves =
          (scout.highSaveRight ?? 0) +
          (scout.highSaveLeft ?? 0) +
          (scout.lowSaveRight ?? 0) +
          (scout.lowSaveLeft ?? 0) +
          (scout.centralSave ?? 0);
        const conceded =
          (scout.goalOutsideArea ?? 0) + (scout.goalInsideArea ?? 0);
        totalSaves += saves;
        totalGoalsConcededFromScouts += conceded;
      }
    }

    const totalShots = totalSaves + totalGoalsConcededFromScouts;
    const savePercentage =
      totalShots > 0
        ? Math.round((totalSaves / totalShots) * 10000) / 100
        : 0;

    const winPercentage =
      totalMatches > 0
        ? Math.round((wins / totalMatches) * 10000) / 100
        : 0;

    return {
      totalMatches,
      wins,
      draws,
      losses,
      goalsScored,
      goalsConceded,
      savePercentage,
      cleanSheets,
      winPercentage,
    };
  }

  async getRecentMatches(goalkeeperId: string, limit = 5): Promise<Match[]> {
    const safeLimit = Math.max(1, Math.min(50, limit));

    return this.matchRepository
      .createQueryBuilder('match')
      .leftJoinAndSelect('match.scouts', 'scouts')
      .where('match.goalkeeperId = :goalkeeperId', { goalkeeperId })
      .orderBy('match.date', 'DESC')
      .take(safeLimit)
      .getMany();
  }
}
