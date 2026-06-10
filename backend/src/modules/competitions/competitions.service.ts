import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Competition } from './entities/competition.entity';

@Injectable()
export class CompetitionsService {
  constructor(@InjectRepository(Competition) private readonly repo: Repository<Competition>) {}
  findAll() { return this.repo.find({ order: { name: 'ASC' } }); }
  async findOne(id: string) {
    const c = await this.repo.findOne({ where: { id } });
    if (!c) throw new NotFoundException(`Competition ${id} not found`);
    return c;
  }
  create(dto: Partial<Competition>) { return this.repo.save(this.repo.create(dto)); }
  async update(id: string, dto: Partial<Competition>) {
    const c = await this.findOne(id);
    return this.repo.save({ ...c, ...dto });
  }
  async remove(id: string) {
    const c = await this.findOne(id);
    return this.repo.remove(c);
  }
}
