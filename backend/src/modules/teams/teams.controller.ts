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
  TeamsService,
  CreateTeamDto,
  UpdateTeamDto,
} from './teams.service';
import { RegisterClubDto } from './dto/register-club.dto';

@ApiTags('teams')
@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  // ─── POST /teams/register (public) ────────────────────────────────────────

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Club self-registration',
    description: 'Public endpoint. Registers a new club and creates the owner admin account. Starts a 30-day trial.',
  })
  @ApiResponse({ status: 201, description: 'Club registered successfully.' })
  @ApiResponse({ status: 409, description: 'Slug or email already in use.' })
  async registerClub(@Body() dto: RegisterClubDto) {
    return this.teamsService.registerClub(dto);
  }

  // ─── GET /teams ────────────────────────────────────────────────────────────

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({
    summary: 'List all teams',
    description: 'Returns a paginated list of teams with optional filtering.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search by name, category, or city' })
  @ApiQuery({ name: 'category', required: false, type: String, example: 'Sub-17' })
  @ApiQuery({ name: 'city', required: false, type: String })
  @ApiQuery({ name: 'country', required: false, type: String })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Paginated team list returned.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('city') city?: string,
    @Query('country') country?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.teamsService.findAll({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      search,
      category,
      city,
      country,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
  }

  // ─── GET /teams/categories ─────────────────────────────────────────────────

  @Get('categories')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({
    summary: 'List all team categories',
    description: 'Returns a distinct list of category values from active teams.',
  })
  @ApiResponse({ status: 200, description: 'Category list returned.', schema: { example: ['Professional', 'Sub-20', 'Sub-17'] } })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  getCategories() {
    return this.teamsService.getCategories();
  }

  // ─── GET /teams/:id ────────────────────────────────────────────────────────

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Get team by ID' })
  @ApiParam({ name: 'id', type: String, format: 'uuid', description: 'Team UUID' })
  @ApiQuery({ name: 'withGoalkeepers', required: false, type: Boolean, description: 'Include goalkeepers relation' })
  @ApiResponse({ status: 200, description: 'Team found.' })
  @ApiResponse({ status: 404, description: 'Team not found.' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('withGoalkeepers') withGoalkeepers?: string,
  ) {
    return this.teamsService.findOne(id, withGoalkeepers === 'true');
  }

  // ─── POST /teams ───────────────────────────────────────────────────────────

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.TECHNICAL_STAFF)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new team',
    description: 'Creates a new team. Requires Admin or Technical Staff role.',
  })
  @ApiResponse({ status: 201, description: 'Team created successfully.' })
  @ApiResponse({ status: 409, description: 'Team with this name and category already exists.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  create(@Body() createTeamDto: CreateTeamDto) {
    return this.teamsService.create(createTeamDto);
  }

  // ─── PATCH /teams/:id ─────────────────────────────────────────────────────

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.TECHNICAL_STAFF)
  @ApiOperation({
    summary: 'Update a team',
    description: 'Updates team data. Requires Admin or Technical Staff role.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Team updated successfully.' })
  @ApiResponse({ status: 404, description: 'Team not found.' })
  @ApiResponse({ status: 409, description: 'Name/category conflict.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTeamDto: UpdateTeamDto,
  ) {
    return this.teamsService.update(id, updateTeamDto);
  }

  // ─── DELETE /teams/:id ────────────────────────────────────────────────────

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Deactivate a team',
    description: 'Admin-only. Soft-deletes a team by marking it inactive.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Team deactivated.' })
  @ApiResponse({ status: 404, description: 'Team not found.' })
  @ApiResponse({ status: 403, description: 'Forbidden – Admin only.' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.teamsService.remove(id);
  }
}
