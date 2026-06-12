import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class ImageGenerationService {
  private readonly logger = new Logger(ImageGenerationService.name);
  private gemini: GoogleGenerativeAI | null = null;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (apiKey) {
      this.gemini = new GoogleGenerativeAI(apiKey);
    }
  }

  async generateImage(prompt: string): Promise<{ base64: string; mimeType: string }> {
    if (!this.gemini) {
      throw new BadRequestException('GEMINI_API_KEY não configurado.');
    }

    const model = this.gemini.getGenerativeModel({ model: 'imagen-3.0-generate-002' } as any);

    const response = await (model as any).generateImages({
      prompt,
      number_of_images: 1,
      aspect_ratio: '1:1',
    });

    const image = response?.generatedImages?.[0];
    if (!image?.image?.imageBytes) {
      throw new BadRequestException('Nenhuma imagem gerada pela API.');
    }

    this.logger.log(`Imagem gerada para prompt: "${prompt}"`);

    return {
      base64: image.image.imageBytes,
      mimeType: image.image.mimeType ?? 'image/png',
    };
  }
}
