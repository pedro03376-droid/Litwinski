import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateExerciseResultDto {
  @ApiProperty({ example: 10, description: 'Total number of attempts' })
  @IsInt()
  @Min(0)
  attempts: number;

  @ApiProperty({ example: 8, description: 'Number of successful attempts' })
  @IsInt()
  @Min(0)
  successes: number;

  @ApiProperty({ example: 2, description: 'Number of failed attempts' })
  @IsInt()
  @Min(0)
  errors: number;

  @ApiPropertyOptional({ example: 80.0, description: 'Success percentage (calculated automatically if omitted)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  successPercentage?: number;

  @ApiPropertyOptional({ example: 0.350, description: 'Average reaction time in seconds' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  reactionTimeSeconds?: number;

  @ApiPropertyOptional({ example: 'Goalkeeper struggled with balls to the left', description: 'Free-text observations' })
  @IsOptional()
  @IsString()
  observations?: string;
}
