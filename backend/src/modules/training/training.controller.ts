import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor';
import { TrainingService, TrainingFilters } from './training.service';
import { CreateTrainingSessionDto } from './dto/create-training-session.dto';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { CreateExerciseResultDto } from './dto/create-exercise-result.dto';
import { TrainingCategory, TrainingIntensity } from './entities/training-session.entity';

@ApiTags('Training')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@UseInterceptors(TransformInterceptor)
@Controller('training')
export class TrainingController {
  constructor(private readonly trainingService: TrainingService) {}

  // ─── GET /training ────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List all training sessions with optional filtering and pagination' })
  @ApiQuery({ name: 'goalkeeperId', required: false, type: String })
  @ApiQuery({ name: 'category', required: false, enum: TrainingCategory })
  @ApiQuery({ name: 'intensity', required: false, enum: TrainingIntensity })
  @ApiQuery({ name: 'season', required: false, type: String })
  @ApiQuery({ name: 'dateFrom', required: false, type: String, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'dateTo', required: false, type: String, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'Paginated list of training sessions' })
  findAll(
    @Query('goalkeeperId') goalkeeperId?: string,
    @Query('category') category?: TrainingCategory,
    @Query('intensity') intensity?: TrainingIntensity,
    @Query('season') season?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const filters: TrainingFilters = { category, intensity, season, dateFrom, dateTo };
    const pagination = {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    };
    return this.trainingService.findAll(goalkeeperId, filters, pagination);
  }

  // ─── GET /training/stats/:goalkeeperId ────────────────────────────────────

  @Get('stats/:goalkeeperId')
  @ApiOperation({ summary: 'Get aggregated training statistics for a goalkeeper' })
  @ApiParam({ name: 'goalkeeperId', type: String })
  @ApiResponse({ status: 200, description: 'Aggregated training statistics' })
  getTrainingStats(@Param('goalkeeperId', ParseUUIDPipe) goalkeeperId: string) {
    return this.trainingService.getTrainingStats(goalkeeperId);
  }

  // ─── GET /training/:id ────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Get a single training session with exercises and results' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Training session details' })
  @ApiResponse({ status: 404, description: 'Training session not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.trainingService.findOne(id);
  }

  // ─── POST /training ───────────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Create a new training session' })
  @ApiResponse({ status: 201, description: 'Training session created' })
  @ApiResponse({ status: 400, description: 'Invalid payload' })
  create(@Body() dto: CreateTrainingSessionDto) {
    return this.trainingService.create(dto);
  }

  // ─── PATCH /training/:id ──────────────────────────────────────────────────

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing training session' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Training session updated' })
  @ApiResponse({ status: 404, description: 'Training session not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateTrainingSessionDto>,
  ) {
    return this.trainingService.update(id, dto);
  }

  // ─── DELETE /training/:id ─────────────────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a training session' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 204, description: 'Training session deleted' })
  @ApiResponse({ status: 404, description: 'Training session not found' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.trainingService.remove(id);
  }

  // ─── POST /training/:id/exercises ─────────────────────────────────────────

  @Post(':id/exercises')
  @ApiOperation({ summary: 'Add an exercise to a training session' })
  @ApiParam({ name: 'id', type: String, description: 'Training session UUID' })
  @ApiResponse({ status: 201, description: 'Exercise added to session' })
  @ApiResponse({ status: 404, description: 'Training session not found' })
  addExercise(
    @Param('id', ParseUUIDPipe) sessionId: string,
    @Body() dto: CreateExerciseDto,
  ) {
    return this.trainingService.addExercise(sessionId, dto);
  }

  // ─── PATCH /training/exercises/:exerciseId ────────────────────────────────

  @Patch('exercises/:exerciseId')
  @ApiOperation({ summary: 'Update an exercise by ID' })
  @ApiParam({ name: 'exerciseId', type: String })
  @ApiResponse({ status: 200, description: 'Exercise updated' })
  @ApiResponse({ status: 404, description: 'Exercise not found' })
  updateExercise(
    @Param('exerciseId', ParseUUIDPipe) exerciseId: string,
    @Body() dto: Partial<CreateExerciseDto>,
  ) {
    return this.trainingService.updateExercise(exerciseId, dto);
  }

  // ─── POST /training/exercises/:exerciseId/results ─────────────────────────

  @Post('exercises/:exerciseId/results')
  @ApiOperation({ summary: 'Add or update the result for a specific exercise' })
  @ApiParam({ name: 'exerciseId', type: String })
  @ApiResponse({ status: 201, description: 'Exercise result recorded' })
  @ApiResponse({ status: 404, description: 'Exercise not found' })
  addExerciseResult(
    @Param('exerciseId', ParseUUIDPipe) exerciseId: string,
    @Body() dto: CreateExerciseResultDto,
  ) {
    return this.trainingService.addExerciseResult(exerciseId, dto);
  }
}
