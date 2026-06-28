import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../modules/users/entities/user.entity';
import { Team } from '../modules/teams/entities/team.entity';
import { UserTeamMembership } from '../modules/teams/entities/user-team-membership.entity';
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

// Single source of truth for the entity list, shared by the Nest TypeORM
// module and the standalone CLI DataSource (migrations).
export const entities = [
  User, Team, UserTeamMembership, Goalkeeper, Match, MatchScout,
  TrainingSession, Exercise, ExerciseResult,
  PerformanceIndex, Video, Report, AiAnalysis,
  Notification, Season, Competition,
];

export const databaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const isProd = configService.get('NODE_ENV') === 'production';
  const databaseUrl = configService.get<string>('DATABASE_URL');

  const base: TypeOrmModuleOptions = {
    type: 'postgres',
    entities,
    // synchronize is DEV-ONLY. In production the schema is managed by
    // migrations (migrationsRun) so the DB is never altered automatically.
    synchronize: !isProd,
    migrations: [__dirname + '/../migrations/*.{ts,js}'],
    migrationsRun: isProd,
    logging: !isProd,
    ssl: isProd ? { rejectUnauthorized: false } : false,
  };

  // Railway (and most PaaS) provide a DATABASE_URL — use it when available
  if (databaseUrl) {
    return { ...base, url: databaseUrl } as TypeOrmModuleOptions;
  }

  return {
    ...base,
    host: configService.get('DB_HOST', 'localhost'),
    port: configService.get<number>('DB_PORT', 5432),
    database: configService.get('DB_NAME', 'gkhub'),
    username: configService.get('DB_USER', 'gkhub'),
    password: configService.get('DB_PASSWORD', 'gkhub_secret'),
  } as TypeOrmModuleOptions;
};
