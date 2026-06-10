import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { HeatmapData } from '../entities/match-scout.entity';

class HeatmapPointDto {
  @ApiPropertyOptional({ example: 0.5 })
  @IsOptional()
  x: number;

  @ApiPropertyOptional({ example: 0.3 })
  @IsOptional()
  y: number;

  @ApiPropertyOptional({ example: 0.8 })
  @IsOptional()
  intensity?: number;
}

class HeatmapDataDto {
  @ApiPropertyOptional({ type: [HeatmapPointDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => HeatmapPointDto)
  saves?: HeatmapPointDto[];

  @ApiPropertyOptional({ type: [HeatmapPointDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => HeatmapPointDto)
  goals?: HeatmapPointDto[];

  @ApiPropertyOptional({ type: [HeatmapPointDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => HeatmapPointDto)
  interceptations?: HeatmapPointDto[];

  @ApiPropertyOptional({ type: [HeatmapPointDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => HeatmapPointDto)
  shotOrigins?: HeatmapPointDto[];
}

export class CreateScoutDto {
  // Defesas Altas (High Saves)
  @ApiPropertyOptional({ example: 3, description: 'High saves to the right', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  highSaveRight?: number;

  @ApiPropertyOptional({ example: 2, description: 'High saves to the left', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  highSaveLeft?: number;

  // Defesas Baixas (Low Saves)
  @ApiPropertyOptional({ example: 1, description: 'Low saves to the right', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  lowSaveRight?: number;

  @ApiPropertyOptional({ example: 2, description: 'Low saves to the left', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  lowSaveLeft?: number;

  // Defesa Central (Central Save)
  @ApiPropertyOptional({ example: 4, description: 'Central saves', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  centralSave?: number;

  // Distribuição (Distribution)
  @ApiPropertyOptional({ example: 5, description: 'Launches with right foot', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  launchRightFoot?: number;

  @ApiPropertyOptional({ example: 1, description: 'Launches with left foot', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  launchLeftFoot?: number;

  @ApiPropertyOptional({ example: 3, description: 'Throws with right hand', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  launchRightHand?: number;

  // Ações Defensivas (Defensive Actions)
  @ApiPropertyOptional({ example: 2, description: 'Interceptions made', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  interceptions?: number;

  @ApiPropertyOptional({ example: 3, description: 'Clearances made', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  clearances?: number;

  // Posicionamento (Positioning)
  @ApiPropertyOptional({ example: 3, description: 'Positioning base — left side', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  positionBaseLeft?: number;

  @ApiPropertyOptional({ example: 4, description: 'Positioning base — right side', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  positionBaseRight?: number;

  // Gols Sofridos (Goals Conceded)
  @ApiPropertyOptional({ example: 0, description: 'Goals conceded from outside the area', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  goalOutsideArea?: number;

  @ApiPropertyOptional({ example: 1, description: 'Goals conceded from inside the area', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  goalInsideArea?: number;

  // Heatmap
  @ApiPropertyOptional({ type: HeatmapDataDto, description: 'Heatmap spatial data' })
  @IsOptional()
  @ValidateNested()
  @Type(() => HeatmapDataDto)
  heatmapData?: HeatmapData;
}
