import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
import { PerformanceService, PerformanceFilters } from './performance.service';
import { PerformanceSource } from './entities/performance-index.entity';

@ApiTags('Performance')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@UseInterceptors(TransformInterceptor)
@Controller('performance')
export class PerformanceController {
  constructor(private readonly performanceService: PerformanceService) {}

  // ─── GET /performance/ranking ─────────────────────────────────────────────

  @Get('ranking')
  @ApiOperation({ summary: 'Get ranking of all goalkeepers sorted by overall performance score' })
  @ApiQuery({ name: 'teamId', required: false, type: String, description: 'Filter by team UUID' })
  @ApiResponse({ status: 200, description: 'Ranked list of goalkeepers' })
  getRanking(@Query('teamId') teamId?: string) {
    return this.performanceService.getRanking(teamId);
  }

  // ─── GET /performance/compare ─────────────────────────────────────────────

  @Get('compare')
  @ApiOperation({ summary: 'Side-by-side comparison of two goalkeepers over a date range' })
  @ApiQuery({ name: 'gkId1', required: true, type: String, description: 'First goalkeeper UUID' })
  @ApiQuery({ name: 'gkId2', required: true, type: String, description: 'Second goalkeeper UUID' })
  @ApiQuery({ name: 'dateFrom', required: false, type: String, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'dateTo', required: false, type: String, description: 'YYYY-MM-DD' })
  @ApiResponse({ status: 200, description: 'Side-by-side performance comparison' })
  getComparison(
    @Query('gkId1') gkId1: string,
    @Query('gkId2') gkId2: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.performanceService.getComparison(gkId1, gkId2, dateFrom, dateTo);
  }

  // ─── GET /performance/evolution/:goalkeeperId ─────────────────────────────

  @Get('evolution/:goalkeeperId')
  @ApiOperation({ summary: 'Get performance evolution chart data for a goalkeeper' })
  @ApiParam({ name: 'goalkeeperId', type: String })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['weekly', 'monthly', 'yearly'],
    description: 'Grouping period for chart data',
  })
  @ApiResponse({ status: 200, description: 'Evolution chart data grouped by period' })
  getEvolutionChart(
    @Param('goalkeeperId', ParseUUIDPipe) goalkeeperId: string,
    @Query('period') period?: 'weekly' | 'monthly' | 'yearly',
  ) {
    return this.performanceService.getEvolutionChart(
      goalkeeperId,
      period ?? 'monthly',
    );
  }

  // ─── GET /performance/:goalkeeperId ───────────────────────────────────────

  @Get(':goalkeeperId')
  @ApiOperation({ summary: 'Get paginated performance index records for a goalkeeper' })
  @ApiParam({ name: 'goalkeeperId', type: String })
  @ApiQuery({ name: 'source', required: false, enum: PerformanceSource })
  @ApiQuery({ name: 'season', required: false, type: String })
  @ApiQuery({ name: 'dateFrom', required: false, type: String, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'dateTo', required: false, type: String, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'Paginated performance index records' })
  findByGoalkeeper(
    @Param('goalkeeperId', ParseUUIDPipe) goalkeeperId: string,
    @Query('source') source?: PerformanceSource,
    @Query('season') season?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const filters: PerformanceFilters = { source, season, dateFrom, dateTo };
    const pagination = {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    };
    return this.performanceService.findByGoalkeeper(goalkeeperId, filters, pagination);
  }
}
