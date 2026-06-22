import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../users/entities/user.entity';
import { Team } from '../teams/entities/team.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export interface AuthPayload {
  access_token: string;
  user: Omit<User, 'password' | 'hashPassword' | 'validatePassword'>;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Validates a user by email and password.
   * Returns the user (without password) on success, or null on failure.
   */
  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email: email.toLowerCase().trim() })
      .andWhere('user.isActive = :isActive', { isActive: true })
      .getOne();

    if (!user) return null;

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return null;

    // Strip password before returning
    const { password: _pw, ...result } = user;
    return result as User;
  }

  /**
   * Authenticates a user and returns a JWT access token along with user data.
   */
  async login(loginDto: LoginDto): Promise<AuthPayload> {
    const { email, password } = loginDto;
    const user = await this.validateUser(email, password);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Resolve the team's planStatus if the user belongs to a team
    let planStatus: string | undefined;
    if (user.teamId) {
      const team = await this.teamRepository.findOne({ where: { id: user.teamId } });
      if (team) {
        planStatus = team.planStatus;
        if (planStatus === 'suspended' || planStatus === 'cancelled') {
          throw new UnauthorizedException('Account suspended');
        }
      }
    }

    // Update lastLoginAt timestamp
    await this.userRepository.update(user.id, { lastLoginAt: new Date() });

    const token = this._signToken(user, planStatus);
    return { access_token: token, user };
  }

  /**
   * Registers a new user account.
   */
  async register(dto: RegisterDto): Promise<AuthPayload> {
    const existing = await this.userRepository.findOne({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const user = this.userRepository.create({
      name: dto.name.trim(),
      email: dto.email.toLowerCase().trim(),
      password: dto.password,
      role: dto.role ?? UserRole.VIEWER,
      isActive: true,
    });

    const saved = await this.userRepository.save(user);

    // Re-fetch without password for response
    const { password: _pw, ...safeUser } = saved;

    const token = this._signToken(safeUser as User);
    return { access_token: token, user: safeUser as User };
  }

  /**
   * Returns the authenticated user's profile without the password field.
   */
  async getProfile(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId, isActive: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Issues a new access token for a currently authenticated user.
   */
  async refreshToken(userId: string): Promise<{ access_token: string }> {
    const user = await this.getProfile(userId);
    const token = this._signToken(user);
    return { access_token: token };
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private _signToken(user: Pick<User, 'id' | 'email' | 'role' | 'teamId'>, planStatus?: string): string {
    const payload: Record<string, unknown> = {
      sub: user.id,
      email: user.email,
      role: user.role,
      teamId: user.teamId ?? null,
      planStatus: planStatus ?? null,
    };
    return this.jwtService.sign(payload);
  }
}
