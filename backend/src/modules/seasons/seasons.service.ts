import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Season } from './entities/season.entity';

@Injectable()
export class SeasonsService {
  constructor(@InjectRepository(Season) private readonly repo: Repository<Season>) {}

  findAll() { return this.repo.find({ order: { startDate: 'DESC' } }); }
  async findOne(id: string) {
    const s = await this.repo.findOne({ where: { id } });
    if (!s) throw new NotFoundException(`Season ${id} not found`);
    return s;
  }
  create(dto: Partial<Season>) { return this.repo.save(this.repo.create(dto)); }
  async update(id: string, dto: Partial<Season>) {
    const s = await this.findOne(id);
    return this.repo.save({ ...s, ...dto });
  }
  async remove(id: string) {
    const s = await this.findOne(id);
    return this.repo.remove(s);
  }
}
