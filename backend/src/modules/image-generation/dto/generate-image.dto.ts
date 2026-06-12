import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateImageDto {
  @ApiProperty({ example: 'Um carro de corrida vermelho em alta velocidade' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  prompt: string;
}
