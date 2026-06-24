import { IsString, IsOptional, IsBoolean, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCompetitionDto {
  @ApiProperty({ example: 'Campeonato Paulista Sub-15' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'FPF' })
  @IsOptional()
  @IsString()
  organizer?: string;

  @ApiPropertyOptional({ example: 'Sub-15' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: '2024/2025' })
  @IsOptional()
  @IsString()
  season?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
