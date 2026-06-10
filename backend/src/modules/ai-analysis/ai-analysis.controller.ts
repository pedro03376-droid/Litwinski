import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiAnalysisService } from './ai-analysis.service';

@ApiTags('ai-analysis')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai-analysis')
export class AiAnalysisController {
  constructor(private readonly aiAnalysisService: AiAnalysisService) {}

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
