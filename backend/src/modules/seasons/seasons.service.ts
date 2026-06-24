import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Season } from './entities/season.entity';
import { CreateSeasonDto } from './dto/create-season.dto';
import { UpdateSeasonDto } from './dto/update-season.dto';

@Injectable()
export class SeasonsService {
  constructor(@InjectRepository(Season) private readonly repo: Repository<Season>) {}

  async findAll(page = 1, limit = 20, activeOnly?: boolean) {
    const qb = this.repo.createQueryBuilder('s').orderBy('s.startDate', 'DESC');
    if (activeOnly) qb.where('s.isActive = :a', { a: true });
    const [data, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();
    return { data, total, page, lastPage: Math.ceil(total / limit) };
  }

  async findOne(id: string): Promise<Season> {
    const s = await this.repo.findOne({ where: { id } });
    if (!s) throw new NotFoundException(`Temporada ${id} não encontrada`);
    return s;
  }

  async create(dto: CreateSeasonDto): Promise<Season> {
    const existing = await this.repo.findOne({ where: { name: dto.name } });
    if (existing) throw new ConflictException(`Temporada "${dto.name}" já existe`);
    if (new Date(dto.startDate) >= new Date(dto.endDate)) {
      throw new ConflictException('Data de início deve ser anterior à data de término');
    }
    const season = this.repo.create(dto);
    return this.repo.save(season);
  }

  async update(id: string, dto: UpdateSeasonDto): Promise<Season> {
    const s = await this.findOne(id);
    if (dto.name && dto.name !== s.name) {
      const existing = await this.repo.findOne({ where: { name: dto.name } });
      if (existing) throw new ConflictException(`Temporada "${dto.name}" já existe`);
    }
    if (dto.startDate && dto.endDate && new Date(dto.startDate) >= new Date(dto.endDate)) {
      throw new ConflictException('Data de início deve ser anterior à data de término');
    }
    return this.repo.save({ ...s, ...dto });
  }

  async setActive(id: string, isActive: boolean): Promise<Season> {
    const s = await this.findOne(id);
    s.isActive = isActive;
    return this.repo.save(s);
  }

  async remove(id: string): Promise<void> {
    const s = await this.findOne(id);
    await this.repo.remove(s);
  }
}
