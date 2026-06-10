import {
  Controller, Get, Post, Patch, Delete, Param, Query,
  UseGuards, UseInterceptors, UploadedFile, Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { VideosService } from './videos.service';
import { VideoContext, VideoType } from './entities/video.entity';

@ApiTags('videos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('videos')
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  @Get()
  @ApiOperation({ summary: 'List videos/photos with filters' })
  findAll(
    @Query('goalkeeperId') goalkeeperId?: string,
    @Query('context') context?: VideoContext,
    @Query('type') type?: VideoType,
    @Query('matchId') matchId?: string,
    @Query('trainingSessionId') trainingSessionId?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.videosService.findAll({ goalkeeperId, context, type, matchId, trainingSessionId, page: +page, limit: +limit });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.videosService.findOne(id);
  }

  @Post('upload')
  @ApiOperation({ summary: 'Upload video or photo file' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  create(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ) {
    return this.videosService.create(file, body, body.goalkeeperId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.videosService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.videosService.remove(id);
  }
}
