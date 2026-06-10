import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Report, ReportType } from './entities/report.entity';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report) private readonly reportRepo: Repository<Report>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(goalkeeperId?: string) {
    const where = goalkeeperId ? { goalkeeperId } : {};
    return this.reportRepo.find({ where, order: { createdAt: 'DESC' }, relations: ['goalkeeper'] });
  }

  async findOne(id: string): Promise<Report> {
    const report = await this.reportRepo.findOne({ where: { id }, relations: ['goalkeeper'] });
    if (!report) throw new NotFoundException(`Report ${id} not found`);
    return report;
  }

  async generateMatchReport(goalkeeperId: string, matchId: string): Promise<Report> {
    const gk = await this.dataSource.query(
      `SELECT g.*, t.name as team_name FROM goalkeepers g LEFT JOIN teams t ON g."teamId" = t.id WHERE g.id = $1`,
      [goalkeeperId],
    );
    const match = await this.dataSource.query(
      `SELECT m.*, ms.* FROM matches m LEFT JOIN match_scouts ms ON ms."matchId" = m.id WHERE m.id = $1`,
      [matchId],
    );
    const perf = await this.dataSource.query(
      `SELECT * FROM performance_indexes WHERE "goalkeeperId" = $1 AND "matchId" = $2`,
      [goalkeeperId, matchId],
    );

    const pdfPath = await this.generatePDF({
      type: 'match',
      goalkeeper: gk[0],
      data: { match: match[0], performance: perf[0] },
    });

    const report = this.reportRepo.create({
      title: `Relatório de Jogo – ${match[0]?.opponent || 'Partida'}`,
      type: ReportType.MATCH,
      pdfUrl: pdfPath,
      goalkeeperId,
      metadata: { matchId },
    });

    return this.reportRepo.save(report);
  }

  async generatePeriodReport(
    goalkeeperId: string,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<Report> {
    const matches = await this.dataSource.query(
      `SELECT COUNT(*) as total,
       AVG(CASE WHEN result = 'win' THEN 1 ELSE 0 END) * 100 as win_rate
       FROM matches WHERE "goalkeeperId" = $1 AND date BETWEEN $2 AND $3`,
      [goalkeeperId, dateFrom, dateTo],
    );

    const performances = await this.dataSource.query(
      `SELECT AVG("overallScore") as avg_score,
       AVG("reflexScore") as avg_reflex,
       AVG("highSaveScore") as avg_high_save,
       AVG("lowSaveScore") as avg_low_save
       FROM performance_indexes
       WHERE "goalkeeperId" = $1 AND date BETWEEN $2 AND $3`,
      [goalkeeperId, dateFrom, dateTo],
    );

    const gk = await this.dataSource.query(
      `SELECT g.*, t.name as team_name FROM goalkeepers g LEFT JOIN teams t ON g."teamId" = t.id WHERE g.id = $1`,
      [goalkeeperId],
    );

    const pdfPath = await this.generatePDF({
      type: 'period',
      goalkeeper: gk[0],
      data: { matches: matches[0], performances: performances[0], dateFrom, dateTo },
    });

    const report = this.reportRepo.create({
      title: `Relatório do Período – ${new Date(dateFrom).toLocaleDateString('pt-BR')} a ${new Date(dateTo).toLocaleDateString('pt-BR')}`,
      type: ReportType.PERIOD,
      pdfUrl: pdfPath,
      goalkeeperId,
      dateFrom,
      dateTo,
    });

    return this.reportRepo.save(report);
  }

  async remove(id: string): Promise<void> {
    const report = await this.findOne(id);
    if (report.pdfUrl && fs.existsSync('.' + report.pdfUrl)) {
      fs.unlinkSync('.' + report.pdfUrl);
    }
    await this.reportRepo.remove(report);
  }

  private async generatePDF(opts: { type: string; goalkeeper: any; data: any }): Promise<string> {
    const outputDir = './uploads/reports';
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const fileName = `report_${opts.goalkeeper?.id || 'unknown'}_${Date.now()}.pdf`;
    const outputPath = path.join(outputDir, fileName);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // Header
      doc.rect(0, 0, doc.page.width, 80).fill('#1a1a2e');
      doc.fillColor('#00d4ff').fontSize(28).font('Helvetica-Bold').text('GKHUB', 50, 25);
      doc.fillColor('#ffffff').fontSize(12).text('Goalkeeper Performance Platform', 50, 55);

      doc.moveDown(3);

      // Goalkeeper info
      if (opts.goalkeeper) {
        doc.fillColor('#333333').fontSize(18).font('Helvetica-Bold')
          .text(opts.goalkeeper.name || 'Goleira', 50);
        doc.fontSize(12).font('Helvetica')
          .text(`Clube: ${opts.goalkeeper.team_name || 'N/A'} | Categoria: ${opts.goalkeeper.category || 'N/A'}`);
      }

      doc.moveDown();

      if (opts.type === 'match' && opts.data.match) {
        doc.fontSize(16).font('Helvetica-Bold').fillColor('#1a1a2e').text('Dados da Partida');
        doc.fontSize(11).font('Helvetica').fillColor('#333333');
        doc.text(`Adversário: ${opts.data.match.opponent || 'N/A'}`);
        doc.text(`Campeonato: ${opts.data.match.competition || 'N/A'}`);
        doc.text(`Data: ${opts.data.match.date ? new Date(opts.data.match.date).toLocaleDateString('pt-BR') : 'N/A'}`);
        doc.text(`Resultado: ${opts.data.match.goalsScored || 0} x ${opts.data.match.goalsConceded || 0}`);
      }

      if (opts.type === 'period' && opts.data.performances) {
        doc.fontSize(16).font('Helvetica-Bold').fillColor('#1a1a2e').text('Análise do Período');
        doc.fontSize(11).font('Helvetica').fillColor('#333333');
        doc.text(`Partidas: ${opts.data.matches?.total || 0}`);
        doc.text(`Taxa de vitórias: ${parseFloat(opts.data.matches?.win_rate || 0).toFixed(1)}%`);
        doc.text(`Nota geral média: ${parseFloat(opts.data.performances?.avg_score || 0).toFixed(2)}`);
        doc.text(`Média defesas altas: ${parseFloat(opts.data.performances?.avg_high_save || 0).toFixed(2)}`);
        doc.text(`Média defesas baixas: ${parseFloat(opts.data.performances?.avg_low_save || 0).toFixed(2)}`);
      }

      doc.moveDown(2);
      doc.fontSize(8).fillColor('#999999')
        .text(`Gerado em ${new Date().toLocaleString('pt-BR')} | GKHUB Platform`, 50, doc.page.height - 40);

      doc.end();
      stream.on('finish', () => resolve(`/uploads/reports/${fileName}`));
      stream.on('error', reject);
    });
  }
}
