import { Controller, Get, Post, Delete, Param, Query, Body, UseGuards, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReportsService } from './reports.service';
import * as fs from 'fs';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  findAll(@Query('goalkeeperId') goalkeeperId?: string) {
    return this.reportsService.findAll(goalkeeperId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.reportsService.findOne(id);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download PDF report' })
  async download(@Param('id') id: string, @Res() res: Response) {
    const report = await this.reportsService.findOne(id);
    const filePath = '.' + report.pdfUrl;
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'PDF não encontrado' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(report.title)}.pdf"`);
    fs.createReadStream(filePath).pipe(res);
  }

  @Post('match')
  @ApiOperation({ summary: 'Generate match performance report' })
  generateMatchReport(@Body() body: { goalkeeperId: string; matchId: string }) {
    return this.reportsService.generateMatchReport(body.goalkeeperId, body.matchId);
  }

  @Post('period')
  @ApiOperation({ summary: 'Generate period/date-range report' })
  generatePeriodReport(@Body() body: { goalkeeperId: string; dateFrom: Date; dateTo: Date }) {
    return this.reportsService.generatePeriodReport(body.goalkeeperId, body.dateFrom, body.dateTo);
  }

  @Post('training')
  @ApiOperation({ summary: 'Generate training session report' })
  generateTrainingReport(@Body() body: { goalkeeperId: string; trainingSessionId: string }) {
    return this.reportsService.generateTrainingReport(body.goalkeeperId, body.trainingSessionId);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.reportsService.remove(id);
  }
}
