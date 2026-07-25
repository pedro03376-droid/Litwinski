import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

/**
 * Endpoint público de verificação de saúde.
 * Usado pelos serviços de hospedagem (Render/Koyeb/Fly) para saber que o
 * backend subiu, e para você conferir rapidamente que está no ar:
 *   GET /api/v1/health  →  { status: 'ok', ... }
 */
@ApiTags('health')
@Controller('health')
export class AppController {
  @Get()
  @ApiOperation({ summary: 'Health check público' })
  health() {
    return { status: 'ok', service: 'gkhub-backend', time: new Date().toISOString() };
  }
}
