import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Competition } from './entities/competition.entity';
import { CreateCompetitionDto } from './dto/create-competition.dto';
import { UpdateCompetitionDto } from './dto/update-competition.dto';

@Injectable()
export class CompetitionsService {
  constructor(@InjectRepository(Competition) private readonly repo: Repository<Competition>) {}

  async findAll(page = 1, limit = 20, filters: { category?: string; season?: string; activeOnly?: boolean; search?: string } = {}) {
    const qb = this.repo.createQueryBuilder('c').orderBy('c.name', 'ASC');
    if (filters.activeOnly) qb.andWhere('c.isActive = :a', { a: true });
    if (filters.category) qb.andWhere('c.category = :cat', { cat: filters.category });
    if (filters.season) qb.andWhere('c.season = :s', { s: filters.season });
    if (filters.search) qb.andWhere('c.name ILIKE :q', { q: `%${filters.search}%` });
    const [data, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();
    return { data, total, page, lastPage: Math.ceil(total / limit) };
  }

  async findOne(id: string): Promise<Competition> {
    const c = await this.repo.findOne({ where: { id } });
    if (!c) throw new NotFoundException(`Competição ${id} não encontrada`);
    return c;
  }

  async create(dto: CreateCompetitionDto): Promise<Competition> {
    const existing = await this.repo.findOne({ where: { name: dto.name } });
    if (existing) throw new ConflictException(`Competição "${dto.name}" já existe`);
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: string, dto: UpdateCompetitionDto): Promise<Competition> {
    const c = await this.findOne(id);
    if (dto.name && dto.name !== c.name) {
      const existing = await this.repo.findOne({ where: { name: dto.name } });
      if (existing) throw new ConflictException(`Competição "${dto.name}" já existe`);
    }
    return this.repo.save({ ...c, ...dto });
  }

  async setActive(id: string, isActive: boolean): Promise<Competition> {
    const c = await this.findOne(id);
    c.isActive = isActive;
    return this.repo.save(c);
  }

  async remove(id: string): Promise<void> {
    const c = await this.findOne(id);
    await this.repo.remove(c);
  }
}
