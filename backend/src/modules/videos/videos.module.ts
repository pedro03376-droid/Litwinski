import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { Video } from './entities/video.entity';
import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';
import { StorageService } from './storage.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Video]),
    MulterModule.register({ dest: './uploads/temp' }),
  ],
  controllers: [VideosController],
  providers: [VideosService, StorageService],
  exports: [VideosService],
})
export class VideosModule {}
