import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MatchScout, HeatmapData } from './entities/match-scout.entity';
import { CreateScoutDto } from './dto/create-scout.dto';

export interface ScoutFilters {
  season?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface AggregatedScoutStats {
  totalMatches: number;
  totalSaves: number;
  highSaves: number;
  lowSaves: number;
  centralSaves: number;
  interceptions: number;
  clearances: number;
  totalLaunches: number;
  goalsConceded: number;
  savePercentage: number;
  averageHighSave: number;
  averageLowSave: number;
  averageInterceptions: number;
  averagePositioning: number;
}

@Injectable()
export class ScoutsService {
  constructor(
    @InjectRepository(MatchScout)
    private readonly scoutRepository: Repository<MatchScout>,
  ) {}

  // ─── Upsert (create or update for a match) ────────────────────────────────

  async createOrUpdate(matchId: string, dto: CreateScoutDto): Promise<MatchScout> {
    let scout = await this.scoutRepository.findOne({ where: { matchId } });

    if (scout) {
      this.scoutRepository.merge(scout, { ...dto });
    } else {
      scout = this.scoutRepository.create({ matchId, ...dto });
    }

    return this.scoutRepository.save(scout);
  }

  // ─── Find by match ────────────────────────────────────────────────────────

  async findByMatch(matchId: string): Promise<MatchScout> {
    const scout = await this.scoutRepository.findOne({
      where: { matchId },
      relations: ['match', 'match.goalkeeper'],
    });

    if (!scout) {
      throw new NotFoundException(`Scout data for match "${matchId}" not found`);
    }

    return scout;
  }

  async findById(id: string): Promise<MatchScout> {
    const scout = await this.scoutRepository.findOne({
      where: { id },
      relations: ['match'],
    });

    if (!scout) throw new NotFoundException(`Scout record "${id}" not found`);
    return scout;
  }

  // ─── Heatmap ──────────────────────────────────────────────────────────────

  async getHeatmapData(matchId: string): Promise<HeatmapData | null> {
    const scout = await this.scoutRepository.findOne({
      where: { matchId },
      select: ['id', 'heatmapData'],
    });

    if (!scout) throw new NotFoundException(`Scout data for match "${matchId}" not found`);
    return scout.heatmapData ?? null;
  }

  async updateHeatmap(matchId: string, heatmapData: HeatmapData): Promise<MatchScout> {
    const scout = await this.scoutRepository.findOne({ where: { matchId } });

    if (!scout) throw new NotFoundException(`Scout data for match "${matchId}" not found`);

    scout.heatmapData = heatmapData;
    return this.scoutRepository.save(scout);
  }

  // ─── Partial update ───────────────────────────────────────────────────────

  async update(id: string, dto: Partial<CreateScoutDto>): Promise<MatchScout> {
    const scout = await this.findById(id);
    this.scoutRepository.merge(scout, dto);
    return this.scoutRepository.save(scout);
  }

  // ─── Aggregated scout stats for a goalkeeper ──────────────────────────────

  async getScoutStats(goalkeeperId: string, filters: ScoutFilters = {}): Promise<AggregatedScoutStats> {
    const qb = this.scoutRepository
      .createQueryBuilder('scout')
      .innerJoin('scout.match', 'match')
      .where('match.goalkeeperId = :goalkeeperId', { goalkeeperId });

    if (filters.season) {
      qb.andWhere('match.season = :season', { season: filters.season });
    }
    if (filters.dateFrom) {
      qb.andWhere('match.date >= :dateFrom', { dateFrom: filters.dateFrom });
    }
    if (filters.dateTo) {
      qb.andWhere('match.date <= :dateTo', { dateTo: filters.dateTo });
    }

    const scouts = await qb.getMany();

    const totalMatches = scouts.length;

    let highSaves = 0;
    let lowSaves = 0;
    let centralSaves = 0;
    let interceptions = 0;
    let clearances = 0;
    let launches = 0;
    let goalsConceded = 0;
    let positioningSum = 0;

    for (const s of scouts) {
      highSaves += (s.highSaveRight ?? 0) + (s.highSaveLeft ?? 0);
      lowSaves += (s.lowSaveRight ?? 0) + (s.lowSaveLeft ?? 0);
      centralSaves += s.centralSave ?? 0;
      interceptions += s.interceptions ?? 0;
      clearances += s.clearances ?? 0;
      launches +=
        (s.launchRightFoot ?? 0) +
        (s.launchLeftFoot ?? 0) +
        (s.launchRightHand ?? 0);
      goalsConceded += (s.goalOutsideArea ?? 0) + (s.goalInsideArea ?? 0);
      positioningSum +=
        ((s.positionBaseLeft ?? 0) + (s.positionBaseRight ?? 0)) / 2;
    }

    const totalSaves = highSaves + lowSaves + centralSaves;
    const totalShots = totalSaves + goalsConceded;
    const savePercentage =
      totalShots > 0
        ? Math.round((totalSaves / totalShots) * 10000) / 100
        : 0;

    return {
      totalMatches,
      totalSaves,
      highSaves,
      lowSaves,
      centralSaves,
      interceptions,
      clearances,
      totalLaunches: launches,
      goalsConceded,
      savePercentage,
      averageHighSave: totalMatches > 0 ? Math.round((highSaves / totalMatches) * 100) / 100 : 0,
      averageLowSave: totalMatches > 0 ? Math.round((lowSaves / totalMatches) * 100) / 100 : 0,
      averageInterceptions: totalMatches > 0 ? Math.round((interceptions / totalMatches) * 100) / 100 : 0,
      averagePositioning: totalMatches > 0 ? Math.round((positioningSum / totalMatches) * 100) / 100 : 0,
    };
  }
}
