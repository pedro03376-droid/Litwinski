import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TeamsModule } from './modules/teams/teams.module';
import { GoalkeepersModule } from './modules/goalkeepers/goalkeepers.module';
import { MatchesModule } from './modules/matches/matches.module';
import { ScoutsModule } from './modules/scouts/scouts.module';
import { TrainingModule } from './modules/training/training.module';
import { PerformanceModule } from './modules/performance/performance.module';
import { VideosModule } from './modules/videos/videos.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AiAnalysisModule } from './modules/ai-analysis/ai-analysis.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ImportModule } from './modules/import/import.module';
import { SeasonsModule } from './modules/seasons/seasons.module';
import { CompetitionsModule } from './modules/competitions/competitions.module';
import { TrainingPlusModule } from './modules/training-plus/training-plus.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { databaseConfig } from './config/database.config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: databaseConfig,
      inject: [ConfigService],
    }),
    // Global rate limit: 100 requests per minute per IP (stricter limits are
    // applied per-route via @Throttle, e.g. on auth/login).
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    CacheModule.register({ isGlobal: true, ttl: 60000 }),
    AuthModule,
    UsersModule,
    TeamsModule,
    GoalkeepersModule,
    MatchesModule,
    ScoutsModule,
    TrainingModule,
    PerformanceModule,
    VideosModule,
    ReportsModule,
    AiAnalysisModule,
    NotificationsModule,
    ImportModule,
    SeasonsModule,
    CompetitionsModule,
    TrainingPlusModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
