import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TpSession, TpSessionBlock } from './entities/session.entity';
import { TpExercise } from './entities/exercise-library.entity';
import { TpAttendance, TpRpe, TpEvaluation, TpGoal } from './entities/records.entity';
import { TrainingPlusService } from './training-plus.service';
import { TrainingPlusController } from './training-plus.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TpSession, TpSessionBlock, TpExercise, TpAttendance, TpRpe, TpEvaluation, TpGoal,
    ]),
  ],
  controllers: [TrainingPlusController],
  providers: [TrainingPlusService],
  exports: [TrainingPlusService],
})
export class TrainingPlusModule {}
