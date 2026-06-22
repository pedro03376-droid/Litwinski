import { IsString, IsNotEmpty, IsEmail, IsOptional, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterClubDto {
  @ApiProperty({ example: 'Atletico Mineiro', description: 'Club name' })
  @IsString()
  @IsNotEmpty()
  clubName: string;

  @ApiProperty({ example: 'atletico-mg', description: 'Unique slug for the club (lowercased, spaces replaced with hyphens)' })
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiProperty({ example: 'admin@atletico.com', description: 'Owner email address' })
  @IsEmail()
  ownerEmail: string;

  @ApiProperty({ example: 'securePass123', description: 'Owner account password (min 8 characters)' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ example: 'Football', description: 'Sport type' })
  @IsString()
  @IsOptional()
  sport?: string;
}
