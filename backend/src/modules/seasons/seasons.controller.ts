import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SeasonsService } from './seasons.service';

@ApiTags('seasons')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('seasons')
export class SeasonsController {
  constructor(private readonly seasonsService: SeasonsService) {}
  @Get() findAll() { return this.seasonsService.findAll(); }
  @Get(':id') findOne(@Param('id') id: string) { return this.seasonsService.findOne(id); }
  @Post() create(@Body() body: any) { return this.seasonsService.create(body); }
  @Patch(':id') update(@Param('id') id: string, @Body() body: any) { return this.seasonsService.update(id, body); }
  @Delete(':id') remove(@Param('id') id: string) { return this.seasonsService.remove(id); }
}
