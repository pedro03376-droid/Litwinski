import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Video, VideoContext, VideoType } from './entities/video.entity';
import { StorageService } from './storage.service';

@Injectable()
export class VideosService {
  constructor(
    @InjectRepository(Video) private readonly videoRepo: Repository<Video>,
    private readonly storageService: StorageService,
  ) {}

  async findAll(filters: {
    goalkeeperId?: string;
    context?: VideoContext;
    type?: VideoType;
    matchId?: string;
    trainingSessionId?: string;
    page?: number;
    limit?: number;
  }) {
    const { goalkeeperId, context, type, matchId, trainingSessionId, page = 1, limit = 20 } = filters;
    const qb = this.videoRepo.createQueryBuilder('v')
      .leftJoinAndSelect('v.goalkeeper', 'gk')
      .orderBy('v.createdAt', 'DESC');

    if (goalkeeperId) qb.andWhere('v.goalkeeperId = :goalkeeperId', { goalkeeperId });
    if (context) qb.andWhere('v.context = :context', { context });
    if (type) qb.andWhere('v.type = :type', { type });
    if (matchId) qb.andWhere('v.matchId = :matchId', { matchId });
    if (trainingSessionId) qb.andWhere('v.trainingSessionId = :trainingSessionId', { trainingSessionId });

    const total = await qb.getCount();
    const data = await qb.skip((page - 1) * limit).take(limit).getMany();
    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<Video> {
    const video = await this.videoRepo.findOne({ where: { id }, relations: ['goalkeeper'] });
    if (!video) throw new NotFoundException(`Video ${id} not found`);
    return video;
  }

  async create(
    file: Express.Multer.File,
    dto: Partial<Video>,
    goalkeeperId: string,
  ): Promise<Video> {
    let url: string;
    if (dto.type === VideoType.PHOTO) {
      url = await this.storageService.uploadPhoto(file.path, file.originalname, goalkeeperId);
    } else {
      url = await this.storageService.uploadVideo(file.path, file.originalname, goalkeeperId);
    }

    const video = this.videoRepo.create({ ...dto, url, goalkeeperId });
    return this.videoRepo.save(video);
  }

  async update(id: string, dto: Partial<Video>): Promise<Video> {
    const video = await this.findOne(id);
    Object.assign(video, dto);
    return this.videoRepo.save(video);
  }

  async remove(id: string): Promise<void> {
    const video = await this.findOne(id);
    await this.storageService.deleteFile(video.url);
    await this.videoRepo.remove(video);
  }
}
