import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GoalkeepersController } from './goalkeepers.controller';
import { GoalkeepersService } from './goalkeepers.service';
import { Goalkeeper } from './entities/goalkeeper.entity';
import { Match } from '../matches/entities/match.entity';
import { TrainingSession } from '../training/entities/training-session.entity';
import { PerformanceIndex } from '../performance/entities/performance-index.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Goalkeeper, Match, TrainingSession, PerformanceIndex]),
  ],
  controllers: [GoalkeepersController],
  providers: [GoalkeepersService],
  exports: [GoalkeepersService],
})
export class GoalkeepersModule {}
