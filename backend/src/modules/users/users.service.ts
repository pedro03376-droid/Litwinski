import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, FindOptionsWhere } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
  IsBoolean,
} from 'class-validator';

// ─── DTOs defined inline to keep the module self-contained ──────────────────

export class CreateUserDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(100) name: string;
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @IsString() @MinLength(6) @MaxLength(128) password: string;
  @ApiPropertyOptional({ enum: UserRole }) @IsOptional() @IsEnum(UserRole) role?: UserRole;
  @ApiPropertyOptional() @IsOptional() @IsString() avatar?: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(100) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(6) @MaxLength(128) password?: string;
  @ApiPropertyOptional({ enum: UserRole }) @IsOptional() @IsEnum(UserRole) role?: UserRole;
  @ApiPropertyOptional() @IsOptional() @IsString() avatar?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class PaginatedUsers {
  data: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UserQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole;
  isActive?: boolean;
  teamId?: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Returns a paginated list of users with optional search / filter support.
   */
  async findAll(params: UserQueryParams = {}): Promise<PaginatedUsers> {
    const {
      page = 1,
      limit = 20,
      search,
      role,
      isActive,
      teamId,
    } = params;

    if (page < 1 || limit < 1 || limit > 100) {
      throw new BadRequestException('page must be ≥ 1 and limit must be between 1 and 100');
    }

    const qb = this.userRepository.createQueryBuilder('user');

    if (search) {
      qb.andWhere(
        '(user.name ILIKE :search OR user.email ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (role !== undefined) {
      qb.andWhere('user.role = :role', { role });
    }

    if (isActive !== undefined) {
      qb.andWhere('user.isActive = :isActive', { isActive });
    }

    if (teamId) {
      qb.andWhere('user.teamId = :teamId', { teamId });
    }

    const [data, total] = await qb
      .orderBy('user.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Finds a single user by ID.
   */
  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    return user;
  }

  /**
   * Finds a user by email address (used internally by AuthService).
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email: email.toLowerCase().trim() },
    });
  }

  /**
   * Creates a new user account.
   */
  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.userRepository.findOne({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const user = this.userRepository.create({
      ...dto,
      email: dto.email.toLowerCase().trim(),
      name: dto.name.trim(),
      role: dto.role ?? UserRole.VIEWER,
    });

    return this.userRepository.save(user);
  }

  /**
   * Updates an existing user's data.
   */
  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    if (dto.email && dto.email.toLowerCase().trim() !== user.email) {
      const conflict = await this.userRepository.findOne({
        where: { email: dto.email.toLowerCase().trim() },
      });
      if (conflict) {
        throw new ConflictException('This email address is already in use');
      }
    }

    const updates: Partial<User> = {
      ...(dto.name && { name: dto.name.trim() }),
      ...(dto.email && { email: dto.email.toLowerCase().trim() }),
      ...(dto.role && { role: dto.role }),
      ...(dto.avatar !== undefined && { avatar: dto.avatar }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    };

    // Password update triggers @BeforeUpdate hook on the entity
    if (dto.password) {
      Object.assign(user, updates, { password: dto.password });
      return this.userRepository.save(user);
    }

    await this.userRepository.update(id, updates);
    return this.findOne(id);
  }

  /**
   * Soft-deletes a user by marking them inactive.
   */
  async remove(id: string): Promise<{ message: string }> {
    const user = await this.findOne(id);
    await this.userRepository.update(id, { isActive: false });
    return { message: `User "${user.name}" has been deactivated` };
  }
}
