import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/decorators/roles.decorator';
import {
  GoalkeepersService,
  CreateGoalkeeperDto,
  UpdateGoalkeeperDto,
  EvolutionPeriod,
} from './goalkeepers.service';

@ApiTags('goalkeepers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('goalkeepers')
export class GoalkeepersController {
  constructor(private readonly goalkeepersService: GoalkeepersService) {}

  // ─── GET /goalkeepers ──────────────────────────────────────────────────────

  @Get()
  @ApiOperation({
    summary: 'List all goalkeepers',
    description: 'Returns a paginated, filterable list of goalkeeper profiles.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search by name or nationality' })
  @ApiQuery({ name: 'teamId', required: false, type: String, description: 'Filter by team UUID' })
  @ApiQuery({ name: 'category', required: false, type: String, example: 'Sub-17' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Paginated goalkeeper list returned.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('teamId') teamId?: string,
    @Query('category') category?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.goalkeepersService.findAll({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      search,
      teamId,
      category,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
  }

  // ─── GET /goalkeepers/:id ──────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Get goalkeeper by ID' })
  @ApiParam({ name: 'id', type: String, format: 'uuid', description: 'Goalkeeper UUID' })
  @ApiResponse({ status: 200, description: 'Goalkeeper found.' })
  @ApiResponse({ status: 404, description: 'Goalkeeper not found.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.goalkeepersService.findOne(id);
  }

  // ─── GET /goalkeepers/:id/stats ────────────────────────────────────────────

  @Get(':id/stats')
  @ApiOperation({
    summary: 'Get goalkeeper statistics summary',
    description:
      'Returns aggregated match results, training session totals, and averaged performance index scores for a goalkeeper.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Statistics summary returned.',
    schema: {
      example: {
        goalkeeper: { id: 'uuid', name: 'Lucas Ferreira', category: 'Sub-17', age: 17 },
        matches: { total: 30, wins: 15, draws: 8, losses: 7, goalsConceded: 22, cleanSheets: 10, saveRate: 84.5 },
        training: { total: 45, totalMinutes: 3375, averageDurationMinutes: 75, byCategory: { reflex: 12, positioning: 8 } },
        performance: { averageOverallScore: 7.4, averageReflexScore: 7.8 },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Goalkeeper not found.' })
  getStatsSummary(@Param('id', ParseUUIDPipe) id: string) {
    return this.goalkeepersService.getStatsSummary(id);
  }

  // ─── GET /goalkeepers/:id/evolution ───────────────────────────────────────

  @Get(':id/evolution')
  @ApiOperation({
    summary: 'Get goalkeeper performance evolution',
    description:
      'Returns time-series performance data grouped by week, month, or year. Each data point contains averaged scores across all performance dimensions.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['weekly', 'monthly', 'yearly'],
    description: 'Aggregation period (default: monthly)',
  })
  @ApiResponse({
    status: 200,
    description: 'Evolution data returned.',
    schema: {
      example: [
        {
          period: '2024-03',
          overallScore: 7.4,
          reflexScore: 7.8,
          positioningScore: 7.1,
          matchCount: 4,
          trainingCount: 8,
        },
      ],
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid period value.' })
  @ApiResponse({ status: 404, description: 'Goalkeeper not found.' })
  getEvolution(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('period') period?: EvolutionPeriod,
  ) {
    return this.goalkeepersService.getEvolution(id, period ?? 'monthly');
  }

  // ─── POST /goalkeepers ─────────────────────────────────────────────────────

  @Post()
  @Roles(UserRole.ADMIN, UserRole.TECHNICAL_STAFF)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new goalkeeper profile',
    description: 'Admin or Technical Staff only.',
  })
  @ApiResponse({ status: 201, description: 'Goalkeeper created successfully.' })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  create(@Body() createGoalkeeperDto: CreateGoalkeeperDto) {
    return this.goalkeepersService.create(createGoalkeeperDto);
  }

  // ─── PATCH /goalkeepers/:id ────────────────────────────────────────────────

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.TECHNICAL_STAFF)
  @ApiOperation({
    summary: 'Update a goalkeeper profile',
    description: 'Admin or Technical Staff only.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Goalkeeper updated.' })
  @ApiResponse({ status: 404, description: 'Goalkeeper not found.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateGoalkeeperDto: UpdateGoalkeeperDto,
  ) {
    return this.goalkeepersService.update(id, updateGoalkeeperDto);
  }

  // ─── DELETE /goalkeepers/:id ───────────────────────────────────────────────

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Deactivate a goalkeeper',
    description: 'Admin-only. Soft-deletes by setting isActive = false.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Goalkeeper deactivated.' })
  @ApiResponse({ status: 404, description: 'Goalkeeper not found.' })
  @ApiResponse({ status: 403, description: 'Forbidden – Admin only.' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.goalkeepersService.remove(id);
  }
}
