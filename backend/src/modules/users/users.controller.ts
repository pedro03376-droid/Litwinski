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
import {
  UsersService,
  CreateUserDto,
  UpdateUserDto,
} from './users.service';
import { UserRole } from './entities/user.entity';
import { UserRole as DecoratorUserRole } from '../../common/decorators/roles.decorator';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ─── GET /users ────────────────────────────────────────────────────────────

  @Get()
  @Roles(DecoratorUserRole.ADMIN, DecoratorUserRole.TECHNICAL_STAFF)
  @ApiOperation({
    summary: 'List all users',
    description: 'Returns a paginated list of users. Admin and Technical Staff only.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search by name or email' })
  @ApiQuery({ name: 'role', required: false, enum: UserRole })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'teamId', required: false, type: String, description: 'Filter users by teamId' })
  @ApiResponse({ status: 200, description: 'Paginated user list.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('role') role?: UserRole,
    @Query('isActive') isActive?: boolean,
    @Query('teamId') teamId?: string,
  ) {
    return this.usersService.findAll({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      search,
      role,
      isActive: isActive !== undefined ? isActive === (true as any) || isActive === ('true' as any) : undefined,
      teamId,
    });
  }

  // ─── GET /users/:id ────────────────────────────────────────────────────────

  @Get(':id')
  @Roles(DecoratorUserRole.ADMIN, DecoratorUserRole.TECHNICAL_STAFF)
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'User found.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  // ─── POST /users ───────────────────────────────────────────────────────────

  @Post()
  @Roles(DecoratorUserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new user',
    description: 'Admin-only. Creates a new user account.',
  })
  @ApiResponse({ status: 201, description: 'User created.' })
  @ApiResponse({ status: 409, description: 'Email already in use.' })
  @ApiResponse({ status: 403, description: 'Forbidden – Admin only.' })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  // ─── PATCH /users/:id ─────────────────────────────────────────────────────

  @Patch(':id')
  @Roles(DecoratorUserRole.ADMIN)
  @ApiOperation({
    summary: 'Update a user',
    description: 'Admin-only. Updates user data.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'User updated.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  @ApiResponse({ status: 403, description: 'Forbidden – Admin only.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  // ─── DELETE /users/:id ────────────────────────────────────────────────────

  @Delete(':id')
  @Roles(DecoratorUserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Deactivate a user',
    description: 'Admin-only. Soft-deletes a user by marking them inactive.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'User deactivated.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  @ApiResponse({ status: 403, description: 'Forbidden – Admin only.' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.remove(id);
  }
}
