import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';
import { Goalkeeper } from '../goalkeepers/entities/goalkeeper.entity';
import { Match } from '../matches/entities/match.entity';
import { MatchScout } from '../scouts/entities/match-scout.entity';
import { TrainingSession } from '../training/entities/training-session.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Goalkeeper, Match, MatchScout, TrainingSession]),
    MulterModule.register({ dest: './uploads/temp' }),
  ],
  controllers: [ImportController],
  providers: [ImportService],
})
export class ImportModule {}
