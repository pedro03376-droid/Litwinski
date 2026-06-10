import {
  Body,
  Controller,
  Get,
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
import { ScoutsService, ScoutFilters } from './scouts.service';
import { CreateScoutDto } from './dto/create-scout.dto';
import { HeatmapData } from './entities/match-scout.entity';

@ApiTags('Scouts')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@UseInterceptors(TransformInterceptor)
@Controller('scouts')
export class ScoutsController {
  constructor(private readonly scoutsService: ScoutsService) {}

  // ─── GET /scouts/match/:matchId ───────────────────────────────────────────

  @Get('match/:matchId')
  @ApiOperation({ summary: 'Get scout data for a specific match' })
  @ApiParam({ name: 'matchId', type: String })
  @ApiResponse({ status: 200, description: 'Scout data for the match' })
  @ApiResponse({ status: 404, description: 'Scout data not found for this match' })
  findByMatch(@Param('matchId', ParseUUIDPipe) matchId: string) {
    return this.scoutsService.findByMatch(matchId);
  }

  // ─── POST /scouts/match/:matchId ──────────────────────────────────────────

  @Post('match/:matchId')
  @ApiOperation({ summary: 'Create or update scout data for a match (upsert)' })
  @ApiParam({ name: 'matchId', type: String })
  @ApiResponse({ status: 200, description: 'Scout data created or updated' })
  @ApiResponse({ status: 400, description: 'Invalid payload' })
  createOrUpdate(
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @Body() dto: CreateScoutDto,
  ) {
    return this.scoutsService.createOrUpdate(matchId, dto);
  }

  // ─── GET /scouts/stats/:goalkeeperId ─────────────────────────────────────

  @Get('stats/:goalkeeperId')
  @ApiOperation({ summary: 'Get aggregated scout statistics for a goalkeeper' })
  @ApiParam({ name: 'goalkeeperId', type: String })
  @ApiQuery({ name: 'season', required: false, type: String })
  @ApiQuery({ name: 'dateFrom', required: false, type: String, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'dateTo', required: false, type: String, description: 'YYYY-MM-DD' })
  @ApiResponse({ status: 200, description: 'Aggregated scout statistics' })
  getScoutStats(
    @Param('goalkeeperId', ParseUUIDPipe) goalkeeperId: string,
    @Query('season') season?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const filters: ScoutFilters = { season, dateFrom, dateTo };
    return this.scoutsService.getScoutStats(goalkeeperId, filters);
  }

  // ─── PATCH /scouts/:id ────────────────────────────────────────────────────

  @Patch(':id')
  @ApiOperation({ summary: 'Partially update a scout record by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Scout record updated' })
  @ApiResponse({ status: 404, description: 'Scout record not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateScoutDto>,
  ) {
    return this.scoutsService.update(id, dto);
  }

  // ─── PATCH /scouts/:id/heatmap ────────────────────────────────────────────

  @Patch(':id/heatmap')
  @ApiOperation({ summary: 'Update heatmap data for a scout record (by scout id — matchId used internally)' })
  @ApiParam({ name: 'id', type: String, description: 'Scout record UUID' })
  @ApiResponse({ status: 200, description: 'Heatmap data updated' })
  @ApiResponse({ status: 404, description: 'Scout record not found' })
  async updateHeatmap(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() heatmapData: HeatmapData,
  ) {
    // Look up the scout record first to get matchId, then delegate to service
    const scout = await this.scoutsService.findById(id);
    return this.scoutsService.updateHeatmap(scout.matchId, heatmapData);
  }
}
