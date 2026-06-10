import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { TrainingCategory, TrainingIntensity } from '../entities/training-session.entity';

export class CreateTrainingSessionDto {
  @ApiProperty({ example: '2024-03-20', description: 'Training date (YYYY-MM-DD)' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({
    enum: TrainingCategory,
    default: TrainingCategory.MIXED,
    description: 'Primary training category',
  })
  @IsOptional()
  @IsEnum(TrainingCategory)
  category?: TrainingCategory;

  @ApiProperty({ example: 'Improve reflexes on low shots', description: 'Training objective' })
  @IsString()
  @MaxLength(300)
  objective: string;

  @ApiPropertyOptional({ example: 90, description: 'Duration in minutes' })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  @ApiPropertyOptional({
    enum: TrainingIntensity,
    default: TrainingIntensity.MEDIUM,
    description: 'Training intensity level',
  })
  @IsOptional()
  @IsEnum(TrainingIntensity)
  intensity?: TrainingIntensity;

  @ApiPropertyOptional({ example: 'Goalkeeper showed fatigue in the last set', description: 'Free-text observations' })
  @IsOptional()
  @IsString()
  observations?: string;

  @ApiPropertyOptional({ example: '2024', description: 'Season identifier' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  season?: string;

  @ApiProperty({ example: 'uuid-of-goalkeeper', description: 'Goalkeeper UUID' })
  @IsUUID()
  goalkeeperId: string;
}
