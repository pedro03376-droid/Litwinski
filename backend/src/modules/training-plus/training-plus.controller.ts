import {
  Controller, Get, Post, Patch, Delete, Param, Query, Body, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TrainingPlusService } from './training-plus.service';
import { SessionStatus } from './entities/session.entity';
import { ExerciseCategory } from './entities/exercise-library.entity';

@ApiTags('training-plus')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('training-plus')
export class TrainingPlusController {
  constructor(private readonly svc: TrainingPlusService) {}

  // Dashboard + summaries
  @Get('dashboard')
  dashboard(@Query('teamId') teamId?: string) { return this.svc.dashboard(teamId); }

  @Get('goalkeeper/:goalkeeperId/summary')
  gkSummary(@Param('goalkeeperId') id: string) { return this.svc.goalkeeperSummary(id); }

  // Sessions
  @Get('sessions')
  listSessions(
    @Query('teamId') teamId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: SessionStatus,
  ) { return this.svc.listSessions({ teamId, from, to, status }); }

  @Get('sessions/:id')
  getSession(@Param('id') id: string) { return this.svc.getSession(id); }

  @Post('sessions')
  createSession(@Body() body: any) { return this.svc.createSession(body); }

  @Patch('sessions/:id')
  updateSession(@Param('id') id: string, @Body() body: any) { return this.svc.updateSession(id, body); }

  @Delete('sessions/:id')
  removeSession(@Param('id') id: string) { return this.svc.removeSession(id); }

  // Attendance / RPE / Evaluation
  @Post('sessions/:id/attendance')
  setAttendance(@Param('id') id: string, @Body() body: { entries: any[] }) {
    return this.svc.setAttendance(id, body.entries || []);
  }

  @Post('sessions/:id/rpe')
  setRpe(@Param('id') id: string, @Body() body: { goalkeeperId: string; value: number; comment?: string }) {
    return this.svc.setRpe(id, body.goalkeeperId, body.value, body.comment);
  }

  @Post('sessions/:id/evaluation')
  setEvaluation(@Param('id') id: string, @Body() body: any) {
    return this.svc.setEvaluation(id, body);
  }

  // Exercise library
  @Get('exercises')
  listExercises(
    @Query('teamId') teamId?: string,
    @Query('category') category?: ExerciseCategory,
    @Query('search') search?: string,
  ) { return this.svc.listExercises({ teamId, category, search }); }

  @Post('exercises')
  createExercise(@Body() body: any) { return this.svc.createExercise(body); }

  @Delete('exercises/:id')
  removeExercise(@Param('id') id: string) { return this.svc.removeExercise(id); }

  // Goals
  @Get('goalkeeper/:goalkeeperId/goals')
  listGoals(@Param('goalkeeperId') id: string) { return this.svc.listGoals(id); }

  @Post('goals')
  createGoal(@Body() body: any) { return this.svc.createGoal(body); }

  @Patch('goals/:id')
  updateGoal(@Param('id') id: string, @Body() body: any) { return this.svc.updateGoal(id, body); }

  @Delete('goals/:id')
  removeGoal(@Param('id') id: string) { return this.svc.removeGoal(id); }
}
