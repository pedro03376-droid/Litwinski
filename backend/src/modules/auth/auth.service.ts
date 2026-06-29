import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../users/entities/user.entity';
import { Team } from '../teams/entities/team.entity';
import { UserTeamMembership } from '../teams/entities/user-team-membership.entity';
import { FirebaseService } from '../notifications/firebase.service';
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
    @InjectRepository(UserTeamMembership)
    private readonly membershipRepository: Repository<UserTeamMembership>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly firebase: FirebaseService,
  ) {}

  /**
   * Logs in via a Firebase Google ID token: verifies it, finds-or-creates the
   * user by email, and returns a backend JWT. Requires FIREBASE_SERVICE_ACCOUNT_JSON.
   */
  async loginWithGoogle(idToken: string): Promise<AuthPayload> {
    const decoded = await this.firebase.verifyIdToken(idToken);
    if (!decoded?.email) {
      throw new UnauthorizedException('Invalid or unverifiable Google token');
    }
    const email = decoded.email.toLowerCase().trim();
    let user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      user = await this.userRepository.save(
        this.userRepository.create({
          email,
          name: decoded.name || email.split('@')[0],
          // Random password — this account signs in via Google, not a password.
          password: Math.random().toString(36).slice(2) + 'Aa1!',
          role: UserRole.TECHNICAL_STAFF,
          isActive: true,
        }),
      );
    }
    let planStatus: string | undefined;
    if (user.teamId) {
      const team = await this.teamRepository.findOne({ where: { id: user.teamId } });
      if (team) planStatus = team.planStatus;
    }
    await this.userRepository.update(user.id, { lastLoginAt: new Date() });
    const { password: _pw, ...safe } = user as any;
    return { access_token: this._signToken(user, planStatus), user: safe as User };
  }

  /**
   * Switches the user's active team/workspace and issues a new token scoped
   * to it. Requires an active membership in the target team.
   */
  async switchTeam(userId: string, teamId: string): Promise<AuthPayload> {
    const membership = await this.membershipRepository.findOne({
      where: { userId, teamId, isActive: true },
    });
    if (!membership) {
      throw new ForbiddenException('You are not a member of this team');
    }

    const team = await this.teamRepository.findOne({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    if (team.planStatus === 'suspended' || team.planStatus === 'cancelled') {
      throw new UnauthorizedException('This team is suspended');
    }

    // Persist the active team so it survives re-login.
    await this.userRepository.update(userId, { teamId });

    const user = await this.getProfile(userId);
    const token = this._signToken(user, team.planStatus);
    return {
      access_token: token,
      user: { ...user, teamName: team.name } as any,
    };
  }

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
