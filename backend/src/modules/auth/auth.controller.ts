import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ─── POST /auth/login ──────────────────────────────────────────────────────

  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Authenticate user',
    description: 'Validates credentials and returns a JWT access token.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful. Returns access_token and user data.',
    schema: {
      example: {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        user: {
          id: 'uuid',
          name: 'João Silva',
          email: 'joao@gkhub.com',
          role: 'technical_staff',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid email or password.' })
  async login(@Request() req: any, @Body() _loginDto: LoginDto) {
    // LocalAuthGuard already validated credentials; req.user holds the validated user.
    // We call login to get the token and update lastLoginAt.
    return this.authService.login(_loginDto);
  }

  // ─── POST /auth/register ───────────────────────────────────────────────────

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new user',
    description: 'Creates a new user account and returns a JWT access token.',
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully. Returns access_token and user data.',
  })
  @ApiResponse({ status: 409, description: 'An account with this email already exists.' })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  // ─── GET /auth/profile ─────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current user profile',
    description: 'Returns the authenticated user\'s profile data (no password).',
  })
  @ApiResponse({
    status: 200,
    description: 'User profile returned successfully.',
    schema: {
      example: {
        id: 'uuid',
        name: 'João Silva',
        email: 'joao@gkhub.com',
        role: 'technical_staff',
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized – invalid or missing token.' })
  async getProfile(@Request() req: any) {
    return this.authService.getProfile(req.user.id);
  }

  // ─── POST /auth/refresh ────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Refresh access token',
    description: 'Issues a new JWT access token for the currently authenticated user.',
  })
  @ApiResponse({
    status: 200,
    description: 'New access token issued.',
    schema: {
      example: { access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized – invalid or expired token.' })
  async refreshToken(@Request() req: any) {
    return this.authService.refreshToken(req.user.id);
  }
}
