import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CompetitionsService } from './competitions.service';

@ApiTags('competitions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('competitions')
export class CompetitionsController {
  constructor(private readonly competitionsService: CompetitionsService) {}
  @Get() findAll() { return this.competitionsService.findAll(); }
  @Get(':id') findOne(@Param('id') id: string) { return this.competitionsService.findOne(id); }
  @Post() create(@Body() body: any) { return this.competitionsService.create(body); }
  @Patch(':id') update(@Param('id') id: string, @Body() body: any) { return this.competitionsService.update(id, body); }
  @Delete(':id') remove(@Param('id') id: string) { return this.competitionsService.remove(id); }
}
