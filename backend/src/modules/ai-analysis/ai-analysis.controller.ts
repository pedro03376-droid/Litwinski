import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiAnalysisService } from './ai-analysis.service';

class GenerateMatchAnalysisDto {
  @ApiProperty() @IsString() goalkeeperId: string;
  @ApiProperty() @IsString() matchId: string;
  @ApiProperty() @IsObject() metrics: any;
  @ApiProperty({ required: false }) @IsOptional() @IsObject() previousMetrics?: any;
}

class GenerateTrainingAnalysisDto {
  @ApiProperty() @IsString() goalkeeperId: string;
  @ApiProperty() @IsString() trainingSessionId: string;
  @ApiProperty() @IsObject() metrics: any;
}

@ApiTags('ai-analysis')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai-analysis')
export class AiAnalysisController {
  constructor(private readonly aiAnalysisService: AiAnalysisService) {}

  @Post('generate/match')
  @ApiOperation({ summary: 'Generate AI analysis for a match' })
  generateMatch(@Body() dto: GenerateMatchAnalysisDto) {
    return this.aiAnalysisService.analyzeMatch(
      dto.goalkeeperId,
      dto.matchId,
      dto.metrics,
      dto.previousMetrics,
    );
  }

  @Post('generate/training')
  @ApiOperation({ summary: 'Generate AI analysis for a training session' })
  generateTraining(@Body() dto: GenerateTrainingAnalysisDto) {
    return this.aiAnalysisService.analyzeTraining(
      dto.goalkeeperId,
      dto.trainingSessionId,
      dto.metrics,
    );
  }

  @Get('goalkeeper/:goalkeeperId')
  @ApiOperation({ summary: 'Get AI analyses for a goalkeeper' })
  findByGoalkeeper(
    @Param('goalkeeperId') goalkeeperId: string,
    @Query('limit') limit = 10,
  ) {
    return this.aiAnalysisService.findByGoalkeeper(goalkeeperId, +limit);
  }

  @Get('match/:matchId')
  @ApiOperation({ summary: 'Get AI analyses for a match' })
  findByMatch(@Param('matchId') matchId: string) {
    return this.aiAnalysisService.findByMatch(matchId);
  }

  @Get('training/:trainingSessionId')
  @ApiOperation({ summary: 'Get AI analyses for a training session' })
  findByTraining(@Param('trainingSessionId') trainingSessionId: string) {
    return this.aiAnalysisService.findByTraining(trainingSessionId);
  }
}
