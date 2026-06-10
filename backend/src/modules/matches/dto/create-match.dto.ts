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
import { MatchLocation, MatchResult } from '../entities/match.entity';

export class CreateMatchDto {
  @ApiProperty({ example: '2024-03-15', description: 'Match date (YYYY-MM-DD)' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: 'Campeonato Paulista', description: 'Competition name' })
  @IsString()
  @MaxLength(150)
  competition: string;

  @ApiProperty({ example: 'São Paulo FC', description: 'Opponent team name' })
  @IsString()
  @MaxLength(150)
  opponent: string;

  @ApiPropertyOptional({
    enum: MatchLocation,
    default: MatchLocation.HOME,
    description: 'Match location (home/away/neutral)',
  })
  @IsOptional()
  @IsEnum(MatchLocation)
  location?: MatchLocation;

  @ApiPropertyOptional({ example: 'Estádio do Morumbi', description: 'Venue name' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  venue?: string;

  @ApiPropertyOptional({ example: 2, description: 'Goals scored by goalkeeper team', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  goalsScored?: number;

  @ApiPropertyOptional({ example: 1, description: 'Goals conceded by goalkeeper', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  goalsConceded?: number;

  @ApiPropertyOptional({
    enum: MatchResult,
    description: 'Match result (win/draw/loss)',
  })
  @IsOptional()
  @IsEnum(MatchResult)
  result?: MatchResult;

  @ApiPropertyOptional({ example: 'Sub-20', description: 'Category / age group' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @ApiPropertyOptional({ example: 'Good reflexes on high balls', description: 'Free-text observations' })
  @IsOptional()
  @IsString()
  observations?: string;

  @ApiPropertyOptional({ example: 'https://...', description: 'Video URL for the match' })
  @IsOptional()
  @IsString()
  videoUrl?: string;

  @ApiPropertyOptional({ example: '2024', description: 'Season identifier' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  season?: string;

  @ApiProperty({ example: 'uuid-of-goalkeeper', description: 'Goalkeeper UUID' })
  @IsUUID()
  goalkeeperId: string;
}
