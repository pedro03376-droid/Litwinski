import { Body, Controller, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ImageGenerationService } from './image-generation.service';
import { GenerateImageDto } from './dto/generate-image.dto';

@ApiTags('Image Generation')
@UseGuards(JwtAuthGuard)
@Controller('image-generation')
export class ImageGenerationController {
  constructor(private readonly service: ImageGenerationService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Gerar imagem a partir de um prompt usando Imagen 3' })
  async generate(@Body() dto: GenerateImageDto, @Res() res: Response) {
    const { base64, mimeType } = await this.service.generateImage(dto.prompt);
    const buffer = Buffer.from(base64, 'base64');
    res.set({ 'Content-Type': mimeType, 'Content-Length': buffer.length });
    res.end(buffer);
  }
}
