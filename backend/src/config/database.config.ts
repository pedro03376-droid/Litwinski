import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../modules/users/entities/user.entity';
import { Team } from '../modules/teams/entities/team.entity';
import { Goalkeeper } from '../modules/goalkeepers/entities/goalkeeper.entity';
import { Match } from '../modules/matches/entities/match.entity';
import { MatchScout } from '../modules/scouts/entities/match-scout.entity';
import { TrainingSession } from '../modules/training/entities/training-session.entity';
import { Exercise } from '../modules/training/entities/exercise.entity';
import { ExerciseResult } from '../modules/training/entities/exercise-result.entity';
import { PerformanceIndex } from '../modules/performance/entities/performance-index.entity';
import { Video } from '../modules/videos/entities/video.entity';
import { Report } from '../modules/reports/entities/report.entity';
import { AiAnalysis } from '../modules/ai-analysis/entities/ai-analysis.entity';
import { Notification } from '../modules/notifications/entities/notification.entity';
import { Season } from '../modules/seasons/entities/season.entity';
import { Competition } from '../modules/competitions/entities/competition.entity';

export const databaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: configService.get('DB_HOST', 'localhost'),
  port: configService.get<number>('DB_PORT', 5432),
  database: configService.get('DB_NAME', 'gkhub'),
  username: configService.get('DB_USER', 'gkhub'),
  password: configService.get('DB_PASSWORD', 'gkhub_secret'),
  entities: [
    User, Team, Goalkeeper, Match, MatchScout,
    TrainingSession, Exercise, ExerciseResult,
    PerformanceIndex, Video, Report, AiAnalysis,
    Notification, Season, Competition,
  ],
  synchronize: configService.get('NODE_ENV') !== 'production',
  logging: configService.get('NODE_ENV') === 'development',
  ssl: configService.get('NODE_ENV') === 'production'
    ? { rejectUnauthorized: false }
    : false,
});
