import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';
import { Team } from './entities/team.entity';
import { User } from '../users/entities/user.entity';
import { UserTeamMembership } from './entities/user-team-membership.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Team, User, UserTeamMembership])],
  controllers: [TeamsController],
  providers: [TeamsService],
  exports: [TeamsService],
})
export class TeamsModule {}
