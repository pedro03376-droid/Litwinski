import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Report, ReportType } from './entities/report.entity';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

const BRAND = '#1a1a2e';
const ACCENT = '#00d4ff';
const SUCCESS = '#10b981';
const DANGER = '#ef4444';
const GRAY = '#6b7280';
const LIGHT = '#f3f4f6';

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
    const [gk] = await this.dataSource.query(
      `SELECT g.*, t.name as team_name FROM goalkeepers g LEFT JOIN teams t ON g."teamId" = t.id WHERE g.id = $1`,
      [goalkeeperId],
    );
    const [match] = await this.dataSource.query(
      `SELECT m.* FROM matches m WHERE m.id = $1`,
      [matchId],
    );
    const [perf] = await this.dataSource.query(
      `SELECT * FROM performance_indexes WHERE "goalkeeperId" = $1 AND "matchId" = $2`,
      [goalkeeperId, matchId],
    );
    const [history] = await this.dataSource.query(
      `SELECT AVG("overallScore") as avg_score FROM performance_indexes WHERE "goalkeeperId" = $1 AND source = 'match' AND "matchId" != $2`,
      [goalkeeperId, matchId],
    );

    const pdfPath = await this.generateMatchPDF({ goalkeeper: gk, match, performance: perf, history });

    const report = this.reportRepo.create({
      title: `Relatório de Jogo – ${match?.opponent || 'Partida'}`,
      type: ReportType.MATCH,
      pdfUrl: pdfPath,
      goalkeeperId,
      metadata: { matchId },
    });
    return this.reportRepo.save(report);
  }

  async generatePeriodReport(goalkeeperId: string, dateFrom: Date, dateTo: Date): Promise<Report> {
    const [gk] = await this.dataSource.query(
      `SELECT g.*, t.name as team_name FROM goalkeepers g LEFT JOIN teams t ON g."teamId" = t.id WHERE g.id = $1`,
      [goalkeeperId],
    );
    const [matchStats] = await this.dataSource.query(
      `SELECT COUNT(*) as total,
       SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) as wins,
       SUM(CASE WHEN result = 'draw' THEN 1 ELSE 0 END) as draws,
       SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END) as losses,
       SUM("goalsConceded") as total_goals_conceded,
       SUM(CASE WHEN "goalsConceded" = 0 THEN 1 ELSE 0 END) as clean_sheets
       FROM matches WHERE "goalkeeperId" = $1 AND date BETWEEN $2 AND $3`,
      [goalkeeperId, dateFrom, dateTo],
    );
    const [perfStats] = await this.dataSource.query(
      `SELECT
       AVG("overallScore") as avg_overall,
       AVG("reflexScore") as avg_reflex,
       AVG("highSaveScore") as avg_high_save,
       AVG("lowSaveScore") as avg_low_save,
       AVG("positioningScore") as avg_positioning,
       AVG("goalExitScore") as avg_goal_exit,
       AVG("distributionScore") as avg_distribution,
       MAX("overallScore") as best_score,
       MIN("overallScore") as worst_score
       FROM performance_indexes WHERE "goalkeeperId" = $1 AND date BETWEEN $2 AND $3`,
      [goalkeeperId, dateFrom, dateTo],
    );
    const [training] = await this.dataSource.query(
      `SELECT COUNT(*) as total_sessions,
       SUM("durationMinutes") as total_minutes,
       COUNT(DISTINCT category) as categories_trained
       FROM training_sessions WHERE "goalkeeperId" = $1 AND date BETWEEN $2 AND $3`,
      [goalkeeperId, dateFrom, dateTo],
    );
    const evolution = await this.dataSource.query(
      `SELECT date, "overallScore" FROM performance_indexes
       WHERE "goalkeeperId" = $1 AND date BETWEEN $2 AND $3
       ORDER BY date ASC LIMIT 10`,
      [goalkeeperId, dateFrom, dateTo],
    );

    const pdfPath = await this.generatePeriodPDF({ goalkeeper: gk, matchStats, perfStats, training, evolution, dateFrom, dateTo });

    const from = new Date(dateFrom).toLocaleDateString('pt-BR');
    const to = new Date(dateTo).toLocaleDateString('pt-BR');
    const report = this.reportRepo.create({
      title: `Relatório do Período – ${from} a ${to}`,
      type: ReportType.PERIOD,
      pdfUrl: pdfPath,
      goalkeeperId,
      dateFrom,
      dateTo,
    });
    return this.reportRepo.save(report);
  }

  async generateTrainingReport(goalkeeperId: string, trainingSessionId: string): Promise<Report> {
    const [gk] = await this.dataSource.query(
      `SELECT g.*, t.name as team_name FROM goalkeepers g LEFT JOIN teams t ON g."teamId" = t.id WHERE g.id = $1`,
      [goalkeeperId],
    );
    const [session] = await this.dataSource.query(
      `SELECT ts.*,
       json_agg(json_build_object(
         'name', e.name, 'sets', e.sets, 'repetitions', e.repetitions,
         'attempts', er.attempts, 'successes', er.successes, 'errors', er.errors,
         'successPercentage', er."successPercentage", 'reactionTime', er."reactionTime"
       )) FILTER (WHERE e.id IS NOT NULL) as exercises
       FROM training_sessions ts
       LEFT JOIN exercises e ON e."trainingSessionId" = ts.id
       LEFT JOIN exercise_results er ON er."exerciseId" = e.id
       WHERE ts.id = $1
       GROUP BY ts.id`,
      [trainingSessionId],
    );

    const pdfPath = await this.generateTrainingPDF({ goalkeeper: gk, session });

    const report = this.reportRepo.create({
      title: `Relatório de Treino – ${session?.date ? new Date(session.date).toLocaleDateString('pt-BR') : trainingSessionId}`,
      type: ReportType.TRAINING,
      pdfUrl: pdfPath,
      goalkeeperId,
      metadata: { trainingSessionId },
    });
    return this.reportRepo.save(report);
  }

  async remove(id: string): Promise<void> {
    const report = await this.findOne(id);
    if (report.pdfUrl && fs.existsSync('.' + report.pdfUrl)) fs.unlinkSync('.' + report.pdfUrl);
    await this.reportRepo.remove(report);
  }

  // ─── PDF helpers ──────────────────────────────────────────────────────────

  private ensureDir(): string {
    const dir = './uploads/reports';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  private addHeader(doc: PDFKit.PDFDocument, subtitle: string) {
    doc.rect(0, 0, doc.page.width, 90).fill(BRAND);
    doc.fillColor(ACCENT).fontSize(30).font('Helvetica-Bold').text('GK', 45, 22);
    doc.fillColor('#ffffff').fontSize(30).font('Helvetica-Bold').text('HUB', 76, 22);
    doc.fillColor('#aaaaaa').fontSize(11).font('Helvetica').text('Goalkeeper Performance Platform', 45, 58);
    doc.fillColor(ACCENT).fontSize(13).font('Helvetica-Bold')
      .text(subtitle, doc.page.width - 250, 36, { width: 200, align: 'right' });
    doc.y = 110;
  }

  private addFooter(doc: PDFKit.PDFDocument) {
    const y = doc.page.height - 35;
    doc.rect(0, y - 10, doc.page.width, 45).fill(BRAND);
    doc.fillColor('#777777').fontSize(8).font('Helvetica').text(
      `Gerado em ${new Date().toLocaleString('pt-BR')} | GKHUB Platform | Confidencial`,
      45, y, { align: 'center', width: doc.page.width - 90 },
    );
  }

  private addGoalkeeperCard(doc: PDFKit.PDFDocument, gk: any) {
    const cardY = doc.y;
    doc.rect(45, cardY, doc.page.width - 90, 58).fill(LIGHT).stroke('#e5e7eb');
    doc.fillColor(BRAND).fontSize(16).font('Helvetica-Bold').text(gk?.name || '—', 60, cardY + 10);
    doc.fillColor(GRAY).fontSize(10).font('Helvetica')
      .text(`Clube: ${gk?.team_name || '—'}  |  Categoria: ${gk?.category || '—'}`, 60, cardY + 32);
    doc.y = cardY + 72;
  }

  private addSectionTitle(doc: PDFKit.PDFDocument, title: string) {
    doc.moveDown(0.4);
    const ty = doc.y;
    doc.rect(45, ty, doc.page.width - 90, 26).fill(BRAND);
    doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold').text(title, 55, ty + 8);
    doc.y = ty + 36;
  }

  private addStatRow(doc: PDFKit.PDFDocument, label: string, value: string, highlight = false) {
    const ry = doc.y;
    doc.rect(45, ry, doc.page.width - 90, 22).fill(highlight ? '#f0fdf4' : '#ffffff').stroke('#e5e7eb');
    doc.fillColor(GRAY).fontSize(10).font('Helvetica').text(label, 55, ry + 6);
    doc.fillColor(BRAND).fontSize(10).font('Helvetica-Bold')
      .text(value, doc.page.width - 180, ry + 6, { width: 130, align: 'right' });
    doc.y = ry + 22;
  }

  private addScoreBar(doc: PDFKit.PDFDocument, label: string, score: number, maxScore = 10) {
    const pct = Math.min(Math.max(score, 0) / maxScore, 1);
    const barW = doc.page.width - 230;
    const ry = doc.y;
    doc.fillColor(GRAY).fontSize(9).font('Helvetica').text(label, 55, ry + 5, { width: 115 });
    doc.rect(178, ry + 7, barW, 9).fill('#e5e7eb');
    const color = pct >= 0.75 ? SUCCESS : pct >= 0.5 ? ACCENT : pct >= 0.3 ? '#f59e0b' : DANGER;
    if (pct > 0) doc.rect(178, ry + 7, barW * pct, 9).fill(color);
    doc.fillColor(BRAND).fontSize(9).font('Helvetica-Bold')
      .text(isNaN(score) ? '—' : score.toFixed(1), 178 + barW + 8, ry + 5);
    doc.y = ry + 22;
  }

  // ─── Match PDF ────────────────────────────────────────────────────────────

  private async generateMatchPDF(opts: {
    goalkeeper: any; match: any; performance: any; history: any;
  }): Promise<string> {
    const dir = this.ensureDir();
    const fileName = `match_${opts.goalkeeper?.id || 'u'}_${Date.now()}.pdf`;

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 45, size: 'A4' });
      const stream = fs.createWriteStream(path.join(dir, fileName));
      doc.pipe(stream);

      this.addHeader(doc, 'Relatório de Partida');
      this.addGoalkeeperCard(doc, opts.goalkeeper);

      const m = opts.match;
      if (m) {
        this.addSectionTitle(doc, 'Dados da Partida');
        this.addStatRow(doc, 'Adversário', m.opponent || '—');
        this.addStatRow(doc, 'Campeonato', m.competition || '—');
        this.addStatRow(doc, 'Data', m.date ? new Date(m.date).toLocaleDateString('pt-BR') : '—');
        this.addStatRow(doc, 'Local', m.location === 'home' ? 'Casa' : m.location === 'away' ? 'Fora' : 'Neutro');
        const resultLabel = m.result === 'win' ? 'Vitória' : m.result === 'loss' ? 'Derrota' : 'Empate';
        this.addStatRow(doc, 'Resultado', `${m.goalsScored ?? 0} x ${m.goalsConceded ?? 0} (${resultLabel})`, m.result === 'win');
        if (m.observations) {
          doc.moveDown(0.3);
          doc.fillColor(GRAY).fontSize(9).font('Helvetica').text(`Observações: ${m.observations}`, 55, doc.y);
        }
      }

      const p = opts.performance;
      if (p) {
        this.addSectionTitle(doc, 'Desempenho Técnico');
        const scores: [string, number][] = [
          ['Nota Geral', +p.overallScore],
          ['Reflexo', +p.reflexScore],
          ['Defesas Altas', +p.highSaveScore],
          ['Defesas Baixas', +p.lowSaveScore],
          ['Posicionamento', +p.positioningScore],
          ['Saída do Gol', +p.goalExitScore],
          ['Jogo com os Pés', +p.footworkScore],
          ['Distribuição', +p.distributionScore],
          ['Tomada de Decisão', +p.decisionMakingScore],
        ];
        scores.forEach(([label, val]) => this.addScoreBar(doc, label, val));

        const avg = opts.history?.avg_score ? +opts.history.avg_score : null;
        if (avg !== null) {
          doc.moveDown(0.4);
          const diff = +p.overallScore - avg;
          const txt = diff >= 0
            ? `▲ ${diff.toFixed(1)} pontos acima da média histórica (${avg.toFixed(1)})`
            : `▼ ${Math.abs(diff).toFixed(1)} pontos abaixo da média histórica (${avg.toFixed(1)})`;
          const color = diff >= 0 ? SUCCESS : DANGER;
          const hy = doc.y;
          doc.rect(45, hy, doc.page.width - 90, 24).fill(diff >= 0 ? '#f0fdf4' : '#fef2f2');
          doc.fillColor(color).fontSize(10).font('Helvetica-Bold').text(txt, 55, hy + 7);
          doc.y = hy + 30;
        }
      }

      this.addFooter(doc);
      doc.end();
      stream.on('finish', () => resolve(`/uploads/reports/${fileName}`));
      stream.on('error', reject);
    });
  }

  // ─── Period PDF ───────────────────────────────────────────────────────────

  private async generatePeriodPDF(opts: {
    goalkeeper: any; matchStats: any; perfStats: any; training: any;
    evolution: any[]; dateFrom: any; dateTo: any;
  }): Promise<string> {
    const dir = this.ensureDir();
    const fileName = `period_${opts.goalkeeper?.id || 'u'}_${Date.now()}.pdf`;

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 45, size: 'A4' });
      const stream = fs.createWriteStream(path.join(dir, fileName));
      doc.pipe(stream);

      const from = new Date(opts.dateFrom).toLocaleDateString('pt-BR');
      const to = new Date(opts.dateTo).toLocaleDateString('pt-BR');
      this.addHeader(doc, `${from} – ${to}`);
      this.addGoalkeeperCard(doc, opts.goalkeeper);

      const ms = opts.matchStats;
      if (ms) {
        this.addSectionTitle(doc, 'Partidas');
        this.addStatRow(doc, 'Total', ms.total || '0');
        this.addStatRow(doc, 'Vitórias', ms.wins || '0', true);
        this.addStatRow(doc, 'Empates', ms.draws || '0');
        this.addStatRow(doc, 'Derrotas', ms.losses || '0');
        this.addStatRow(doc, 'Clean sheets', ms.clean_sheets || '0', true);
        this.addStatRow(doc, 'Gols sofridos', ms.total_goals_conceded || '0');
      }

      const ps = opts.perfStats;
      if (ps && ps.avg_overall !== null) {
        this.addSectionTitle(doc, 'Desempenho Médio do Período');
        const scores: [string, number][] = [
          ['Nota Geral', +(ps.avg_overall ?? 0)],
          ['Reflexo', +(ps.avg_reflex ?? 0)],
          ['Defesas Altas', +(ps.avg_high_save ?? 0)],
          ['Defesas Baixas', +(ps.avg_low_save ?? 0)],
          ['Posicionamento', +(ps.avg_positioning ?? 0)],
          ['Saída do Gol', +(ps.avg_goal_exit ?? 0)],
          ['Distribuição', +(ps.avg_distribution ?? 0)],
        ];
        scores.forEach(([label, val]) => this.addScoreBar(doc, label, val));
        doc.moveDown(0.3);
        this.addStatRow(doc, 'Melhor nota', (+ps.best_score || 0).toFixed(2), true);
        this.addStatRow(doc, 'Pior nota', (+ps.worst_score || 0).toFixed(2));
      }

      const tr = opts.training;
      if (tr && +tr.total_sessions > 0) {
        this.addSectionTitle(doc, 'Treinos');
        this.addStatRow(doc, 'Sessões', tr.total_sessions || '0');
        const mins = +(tr.total_minutes || 0);
        this.addStatRow(doc, 'Tempo total', `${Math.floor(mins / 60)}h ${mins % 60}min`);
        this.addStatRow(doc, 'Categorias trabalhadas', tr.categories_trained || '0');
      }

      const evo = opts.evolution;
      if (evo && evo.length > 1) {
        this.addSectionTitle(doc, 'Evolução da Nota Geral');
        const evY = doc.y + 4;
        const evH = 70;
        const evW = doc.page.width - 100;
        const evX = 50;
        doc.rect(evX, evY, evW, evH).fill('#f9fafb').stroke('#e5e7eb');
        const step = evW / (evo.length - 1);
        for (let i = 0; i < evo.length - 1; i++) {
          const x1 = evX + i * step;
          const y1 = evY + evH - (+(evo[i].overallScore) / 10) * evH;
          const x2 = evX + (i + 1) * step;
          const y2 = evY + evH - (+(evo[i + 1].overallScore) / 10) * evH;
          doc.moveTo(x1, y1).lineTo(x2, y2).lineWidth(2).stroke(ACCENT);
          doc.circle(x1, y1, 3).fill(ACCENT);
        }
        const lastX = evX + (evo.length - 1) * step;
        const lastY = evY + evH - (+(evo[evo.length - 1].overallScore) / 10) * evH;
        doc.circle(lastX, lastY, 3).fill(ACCENT);
        doc.y = evY + evH + 12;
      }

      this.addFooter(doc);
      doc.end();
      stream.on('finish', () => resolve(`/uploads/reports/${fileName}`));
      stream.on('error', reject);
    });
  }

  // ─── Training PDF ─────────────────────────────────────────────────────────

  private async generateTrainingPDF(opts: { goalkeeper: any; session: any }): Promise<string> {
    const dir = this.ensureDir();
    const fileName = `training_${opts.goalkeeper?.id || 'u'}_${Date.now()}.pdf`;

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 45, size: 'A4' });
      const stream = fs.createWriteStream(path.join(dir, fileName));
      doc.pipe(stream);

      this.addHeader(doc, 'Relatório de Treino');
      this.addGoalkeeperCard(doc, opts.goalkeeper);

      const s = opts.session;
      if (!s) {
        doc.fillColor(GRAY).text('Sessão não encontrada.', 55, doc.y);
        this.addFooter(doc);
        doc.end();
        stream.on('finish', () => resolve(`/uploads/reports/${fileName}`));
        stream.on('error', reject);
        return;
      }

      this.addSectionTitle(doc, 'Informações da Sessão');
      this.addStatRow(doc, 'Data', s.date ? new Date(s.date).toLocaleDateString('pt-BR') : '—');
      this.addStatRow(doc, 'Categoria', s.category || '—');
      this.addStatRow(doc, 'Intensidade', s.intensity || '—');
      this.addStatRow(doc, 'Duração', s.durationMinutes ? `${s.durationMinutes} minutos` : '—');
      this.addStatRow(doc, 'Objetivo', s.objective || '—');
      if (s.season) this.addStatRow(doc, 'Temporada', s.season);

      const exercises: any[] = Array.isArray(s.exercises) ? s.exercises.filter((e: any) => e?.name) : [];
      if (exercises.length > 0) {
        this.addSectionTitle(doc, `Exercícios (${exercises.length})`);
        let totalAttempts = 0;
        let totalSuccesses = 0;

        exercises.forEach((ex: any, i: number) => {
          const ry = doc.y;
          doc.rect(45, ry, doc.page.width - 90, 20).fill(i % 2 === 0 ? LIGHT : '#ffffff').stroke('#e5e7eb');
          doc.fillColor(BRAND).fontSize(9).font('Helvetica-Bold').text(`${i + 1}. ${ex.name}`, 55, ry + 6, { width: 200 });
          const sets = ex.sets ? `${ex.sets}x${ex.repetitions}` : '—';
          doc.fillColor(GRAY).fontSize(9).font('Helvetica').text(sets, 265, ry + 6, { width: 60 });
          if (ex.successPercentage != null) {
            const pct = +ex.successPercentage;
            const color = pct >= 75 ? SUCCESS : pct >= 50 ? '#f59e0b' : DANGER;
            doc.fillColor(color).fontSize(9).font('Helvetica-Bold')
              .text(`${pct.toFixed(0)}%`, doc.page.width - 100, ry + 6, { width: 50, align: 'right' });
          }
          doc.y = ry + 20;
          totalAttempts += +(ex.attempts || 0);
          totalSuccesses += +(ex.successes || 0);
        });

        if (totalAttempts > 0) {
          const pct = (totalSuccesses / totalAttempts) * 100;
          this.addSectionTitle(doc, 'Resumo');
          this.addStatRow(doc, 'Total de tentativas', totalAttempts.toString());
          this.addStatRow(doc, 'Total de acertos', totalSuccesses.toString(), true);
          this.addScoreBar(doc, 'Taxa de acerto geral', pct, 100);
        }
      }

      if (s.observations) {
        doc.moveDown(0.5);
        doc.fillColor(GRAY).fontSize(9).font('Helvetica').text(`Observações: ${s.observations}`, 55, doc.y);
      }

      this.addFooter(doc);
      doc.end();
      stream.on('finish', () => resolve(`/uploads/reports/${fileName}`));
      stream.on('error', reject);
    });
  }
}
