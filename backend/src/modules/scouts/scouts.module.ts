import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatchScout } from './entities/match-scout.entity';
import { ScoutsController } from './scouts.controller';
import { ScoutsService } from './scouts.service';

@Module({
  imports: [TypeOrmModule.forFeature([MatchScout])],
  controllers: [ScoutsController],
  providers: [ScoutsService],
  exports: [ScoutsService],
})
export class ScoutsModule {}
