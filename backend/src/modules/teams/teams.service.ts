import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  MinLength,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { Team } from './entities/team.entity';

// ─── DTOs ────────────────────────────────────────────────────────────────────

export class CreateTeamDto {
  @ApiProperty({ example: 'Flamengo', description: 'Team name' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'Sub-17', description: 'Team category (e.g. Sub-17, Professional)' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  category: string;

  @ApiPropertyOptional({ example: 'Rio de Janeiro' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ example: 'RJ' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  state?: string;

  @ApiPropertyOptional({ example: 'Brazil' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiPropertyOptional({ example: 1895 })
  @IsOptional()
  @IsInt()
  @Min(1800)
  @Max(new Date().getFullYear())
  foundedYear?: number;

  @ApiPropertyOptional({ description: 'Technical staff names or JSON string' })
  @IsOptional()
  @IsString()
  technicalStaff?: string;

  @ApiPropertyOptional({ example: '#E81C2E' })
  @IsOptional()
  @IsString()
  primaryColor?: string;

  @ApiPropertyOptional({ example: '#000000' })
  @IsOptional()
  @IsString()
  secondaryColor?: string;

  @ApiPropertyOptional({ description: 'URL or path to team shield/logo' })
  @IsOptional()
  @IsString()
  shield?: string;
}

export class UpdateTeamDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(100) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(50) category?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) state?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) country?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1800) foundedYear?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() technicalStaff?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() primaryColor?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() secondaryColor?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() shield?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class PaginatedTeams {
  data: Team[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TeamQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  city?: string;
  country?: string;
  isActive?: boolean;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class TeamsService {
  constructor(
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
  ) {}

  /**
   * Returns a paginated list of teams with optional search / filter support.
   */
  async findAll(params: TeamQueryParams = {}): Promise<PaginatedTeams> {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      city,
      country,
      isActive,
    } = params;

    if (page < 1 || limit < 1 || limit > 100) {
      throw new BadRequestException('page must be >= 1 and limit must be between 1 and 100');
    }

    const qb = this.teamRepository.createQueryBuilder('team');

    if (search) {
      qb.andWhere(
        '(team.name ILIKE :search OR team.category ILIKE :search OR team.city ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (category) {
      qb.andWhere('team.category ILIKE :category', { category: `%${category}%` });
    }

    if (city) {
      qb.andWhere('team.city ILIKE :city', { city: `%${city}%` });
    }

    if (country) {
      qb.andWhere('team.country ILIKE :country', { country: `%${country}%` });
    }

    if (isActive !== undefined) {
      qb.andWhere('team.isActive = :isActive', { isActive });
    }

    const [data, total] = await qb
      .orderBy('team.name', 'ASC')
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
   * Finds a single team by ID, optionally loading its goalkeepers.
   */
  async findOne(id: string, withGoalkeepers = false): Promise<Team> {
    const relations = withGoalkeepers ? ['goalkeepers'] : [];
    const team = await this.teamRepository.findOne({
      where: { id },
      relations,
    });

    if (!team) {
      throw new NotFoundException(`Team with ID "${id}" not found`);
    }

    return team;
  }

  /**
   * Creates a new team.
   */
  async create(dto: CreateTeamDto): Promise<Team> {
    const existing = await this.teamRepository.findOne({
      where: { name: dto.name.trim(), category: dto.category.trim() },
    });

    if (existing) {
      throw new ConflictException(
        `A team named "${dto.name}" in category "${dto.category}" already exists`,
      );
    }

    const team = this.teamRepository.create({
      ...dto,
      name: dto.name.trim(),
      category: dto.category.trim(),
      isActive: true,
    });

    return this.teamRepository.save(team);
  }

  /**
   * Updates an existing team.
   */
  async update(id: string, dto: UpdateTeamDto): Promise<Team> {
    const team = await this.findOne(id);

    // Check name+category uniqueness only when both are changing
    if (dto.name || dto.category) {
      const newName = dto.name?.trim() ?? team.name;
      const newCategory = dto.category?.trim() ?? team.category;

      if (newName !== team.name || newCategory !== team.category) {
        const conflict = await this.teamRepository.findOne({
          where: { name: newName, category: newCategory },
        });
        if (conflict && conflict.id !== id) {
          throw new ConflictException(
            `A team named "${newName}" in category "${newCategory}" already exists`,
          );
        }
      }
    }

    const updates: Partial<Team> = {
      ...(dto.name !== undefined && { name: dto.name.trim() }),
      ...(dto.category !== undefined && { category: dto.category.trim() }),
      ...(dto.city !== undefined && { city: dto.city }),
      ...(dto.state !== undefined && { state: dto.state }),
      ...(dto.country !== undefined && { country: dto.country }),
      ...(dto.foundedYear !== undefined && { foundedYear: dto.foundedYear }),
      ...(dto.technicalStaff !== undefined && { technicalStaff: dto.technicalStaff }),
      ...(dto.primaryColor !== undefined && { primaryColor: dto.primaryColor }),
      ...(dto.secondaryColor !== undefined && { secondaryColor: dto.secondaryColor }),
      ...(dto.shield !== undefined && { shield: dto.shield }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    };

    await this.teamRepository.update(id, updates);
    return this.findOne(id);
  }

  /**
   * Soft-deletes a team by marking it inactive.
   */
  async remove(id: string): Promise<{ message: string }> {
    const team = await this.findOne(id);
    await this.teamRepository.update(id, { isActive: false });
    return { message: `Team "${team.name}" has been deactivated` };
  }

  /**
   * Returns distinct categories across all active teams.
   */
  async getCategories(): Promise<string[]> {
    const rows = await this.teamRepository
      .createQueryBuilder('team')
      .select('DISTINCT team.category', 'category')
      .where('team.isActive = true')
      .orderBy('team.category', 'ASC')
      .getRawMany<{ category: string }>();

    return rows.map((r) => r.category);
  }
}
