import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateExerciseDto {
  @ApiProperty({ example: 'Low Shot Reflex Drill', description: 'Exercise name' })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ example: 'Improve reaction time on ground balls', description: 'Exercise objective' })
  @IsOptional()
  @IsString()
  objective?: string;

  @ApiPropertyOptional({ example: 3, description: 'Number of sets' })
  @IsOptional()
  @IsInt()
  @Min(1)
  sets?: number;

  @ApiPropertyOptional({ example: 10, description: 'Number of repetitions per set' })
  @IsOptional()
  @IsInt()
  @Min(1)
  repetitions?: number;

  @ApiPropertyOptional({ example: 30, description: 'Duration of the exercise in seconds' })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationSeconds?: number;

  @ApiPropertyOptional({ example: 60, description: 'Rest time between sets in seconds' })
  @IsOptional()
  @IsInt()
  @Min(0)
  restSeconds?: number;

  @ApiPropertyOptional({ example: 'https://...', description: 'Video URL demonstrating the exercise' })
  @IsOptional()
  @IsString()
  videoUrl?: string;

  @ApiPropertyOptional({ example: 'https://...', description: 'Image URL for the exercise' })
  @IsOptional()
  @IsString()
  imageUrl?: string;
}
