import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication, ValidationPipe, Controller, Get, Post, Body, UseGuards,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ThrottlerModule, ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IsString, IsInt, Min } from 'class-validator';
import * as request from 'supertest';

import { JwtStrategy } from '../src/modules/auth/strategies/jwt.strategy';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { User } from '../src/modules/users/entities/user.entity';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

const JWT_SECRET = 'e2e-test-secret';

// DTO with validation to exercise the global ValidationPipe.
class CreateThingDto {
  @IsString() name: string;
  @IsInt() @Min(1) quantity: number;
}

// A minimal controller that exercises the real cross-cutting HTTP machinery.
@Controller('things')
class TestThingsController {
  @Get('open')
  open() {
    return { hello: 'world' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('secure')
  secure() {
    return { secret: true };
  }

  @Post()
  create(@Body() dto: CreateThingDto) {
    return dto;
  }

  @Throttle({ default: { ttl: 60000, limit: 2 } })
  @Get('limited')
  limited() {
    return { ok: true };
  }
}

describe('HTTP stack (guards / pipes / interceptor / filter / throttler) e2e', () => {
  let app: INestApplication;
  let jwt: JwtService;

  // Mock user repo so the real JwtStrategy.validate() can resolve a user.
  const mockUserRepo = {
    findOne: jest.fn(({ where }: any) =>
      where?.id === 'user-1'
        ? Promise.resolve({ id: 'user-1', email: 'a@b.com', role: 'admin', isActive: true })
        : Promise.resolve(null),
    ),
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = JWT_SECRET;

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PassportModule,
        JwtModule.register({ secret: JWT_SECRET }),
        ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
      ],
      controllers: [TestThingsController],
      providers: [
        JwtStrategy,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    // Mirror the production global config from main.ts.
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();

    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    await app?.close();
  });

  const token = (sub: string) =>
    jwt.sign({ sub, email: 'a@b.com', role: 'admin' }, { secret: JWT_SECRET });

  describe('TransformInterceptor', () => {
    it('wraps successful responses in {success, data, timestamp}', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/things/open').expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({ hello: 'world' });
      expect(typeof res.body.timestamp).toBe('string');
    });
  });

  describe('Global prefix', () => {
    it('serves routes under /api/v1 (404 without the prefix)', async () => {
      await request(app.getHttpServer()).get('/things/open').expect(404);
    });
  });

  describe('JwtAuthGuard', () => {
    it('rejects protected routes without a token (401)', async () => {
      await request(app.getHttpServer()).get('/api/v1/things/secure').expect(401);
    });

    it('rejects an invalid/garbage token (401)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/things/secure')
        .set('Authorization', 'Bearer not-a-real-token')
        .expect(401);
    });

    it('rejects a validly-signed token for a non-existent user (401)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/things/secure')
        .set('Authorization', `Bearer ${token('ghost')}`)
        .expect(401);
    });

    it('allows a valid token for an existing user (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/things/secure')
        .set('Authorization', `Bearer ${token('user-1')}`)
        .expect(200);
      expect(res.body.data).toEqual({ secret: true });
    });
  });

  describe('ValidationPipe', () => {
    it('rejects an invalid body (400) via the HttpExceptionFilter envelope', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/things')
        .send({ name: 123 }) // wrong type + missing quantity
        .expect(400);
      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(400);
      expect(res.body.path).toBe('/api/v1/things');
    });

    it('accepts a valid body (201)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/things')
        .send({ name: 'ball', quantity: 3 })
        .expect(201);
      expect(res.body.data).toEqual({ name: 'ball', quantity: 3 });
    });
  });

  describe('ThrottlerGuard', () => {
    it('returns 429 after exceeding the per-route limit', async () => {
      const server = app.getHttpServer();
      await request(server).get('/api/v1/things/limited').expect(200);
      await request(server).get('/api/v1/things/limited').expect(200);
      // 3rd request within the window exceeds limit: 2
      await request(server).get('/api/v1/things/limited').expect(429);
    });
  });
});
