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
import { MatchesService, MatchFilters } from './matches.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { MatchResult } from './entities/match.entity';

@ApiTags('Matches')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@UseInterceptors(TransformInterceptor)
@Controller('matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  // ─── GET /matches ─────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List all matches with optional filtering and pagination' })
  @ApiQuery({ name: 'goalkeeperId', required: false, type: String })
  @ApiQuery({ name: 'competition', required: false, type: String })
  @ApiQuery({ name: 'result', required: false, enum: MatchResult })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'season', required: false, type: String })
  @ApiQuery({ name: 'dateFrom', required: false, type: String, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'dateTo', required: false, type: String, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'Paginated list of matches' })
  findAll(
    @Query('goalkeeperId') goalkeeperId?: string,
    @Query('competition') competition?: string,
    @Query('result') result?: MatchResult,
    @Query('category') category?: string,
    @Query('season') season?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const filters: MatchFilters = { competition, result, category, season, dateFrom, dateTo };
    const pagination = {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    };
    return this.matchesService.findAll(goalkeeperId, filters, pagination);
  }

  // ─── GET /matches/stats/:goalkeeperId ─────────────────────────────────────

  @Get('stats/:goalkeeperId')
  @ApiOperation({ summary: 'Get aggregated match statistics for a goalkeeper' })
  @ApiParam({ name: 'goalkeeperId', type: String })
  @ApiResponse({ status: 200, description: 'Aggregated match stats' })
  @ApiResponse({ status: 404, description: 'Goalkeeper not found' })
  getMatchStats(@Param('goalkeeperId', ParseUUIDPipe) goalkeeperId: string) {
    return this.matchesService.getMatchStats(goalkeeperId);
  }

  // ─── GET /matches/recent/:goalkeeperId ────────────────────────────────────

  @Get('recent/:goalkeeperId')
  @ApiOperation({ summary: 'Get the most recent N matches for a goalkeeper' })
  @ApiParam({ name: 'goalkeeperId', type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 5 })
  @ApiResponse({ status: 200, description: 'List of recent matches with scout data' })
  getRecentMatches(
    @Param('goalkeeperId', ParseUUIDPipe) goalkeeperId: string,
    @Query('limit') limit?: string,
  ) {
    return this.matchesService.getRecentMatches(
      goalkeeperId,
      limit ? parseInt(limit, 10) : 5,
    );
  }

  // ─── GET /matches/:id ─────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Get a single match by ID with all relations' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Match details' })
  @ApiResponse({ status: 404, description: 'Match not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.matchesService.findOne(id);
  }

  // ─── POST /matches ────────────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Create a new match' })
  @ApiResponse({ status: 201, description: 'Match created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid payload' })
  create(@Body() dto: CreateMatchDto) {
    return this.matchesService.create(dto);
  }

  // ─── PATCH /matches/:id ───────────────────────────────────────────────────

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing match' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Match updated successfully' })
  @ApiResponse({ status: 404, description: 'Match not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateMatchDto>,
  ) {
    return this.matchesService.update(id, dto);
  }

  // ─── DELETE /matches/:id ──────────────────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a match' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 204, description: 'Match deleted' })
  @ApiResponse({ status: 404, description: 'Match not found' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.matchesService.remove(id);
  }
}
