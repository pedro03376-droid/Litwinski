import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiAnalysis } from './entities/ai-analysis.entity';
import { AiAnalysisService } from './ai-analysis.service';
import { AiAnalysisController } from './ai-analysis.controller';
import { LlmAnalysisService } from './llm-analysis.service';

@Module({
  imports: [TypeOrmModule.forFeature([AiAnalysis])],
  controllers: [AiAnalysisController],
  providers: [AiAnalysisService, LlmAnalysisService],
  exports: [AiAnalysisService],
})
export class AiAnalysisModule {}
