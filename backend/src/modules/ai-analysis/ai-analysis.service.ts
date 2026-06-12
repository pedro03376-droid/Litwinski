import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiAnalysis, AnalysisSource } from './entities/ai-analysis.entity';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface ScoutMetrics {
  highSaveRight: number;
  highSaveLeft: number;
  lowSaveRight: number;
  lowSaveLeft: number;
  centralSave: number;
  interceptions: number;
  launchRightFoot: number;
  launchLeftFoot: number;
  launchRightHand: number;
  positionBaseLeft: number;
  positionBaseRight: number;
  goalOutsideArea: number;
  goalInsideArea: number;
}

interface TrainingMetrics {
  totalExercises: number;
  successRate: number;
  avgReactionTime: number;
  categoryBreakdown: Record<string, number>;
}

interface AnalysisResult {
  strengths: string[];
  attentionPoints: string[];
  evolutionNotes: string[];
  trainingSuggestions: string[];
  overallScore: number;
}

@Injectable()
export class AiAnalysisService {
  private readonly logger = new Logger(AiAnalysisService.name);
  private gemini: GoogleGenerativeAI | null = null;

  constructor(
    @InjectRepository(AiAnalysis)
    private readonly analysisRepo: Repository<AiAnalysis>,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (apiKey) {
      this.gemini = new GoogleGenerativeAI(apiKey);
      this.logger.log('Gemini AI initialized');
    } else {
      this.logger.warn('GEMINI_API_KEY not set – using rule-based analysis');
    }
  }

  async analyzeMatch(
    goalkeeperId: string,
    matchId: string,
    metrics: ScoutMetrics,
    previousMetrics?: ScoutMetrics,
  ): Promise<AiAnalysis> {
    let analysis: AnalysisResult;

    if (this.gemini) {
      analysis = await this.geminiMatchAnalysis(metrics, previousMetrics);
    } else {
      analysis = this.generateMatchAnalysis(metrics, previousMetrics);
    }

    const entity = this.analysisRepo.create({
      goalkeeperId,
      matchId,
      source: AnalysisSource.MATCH,
      strengths: analysis.strengths,
      attentionPoints: analysis.attentionPoints,
      evolutionNotes: analysis.evolutionNotes,
      trainingSuggestions: analysis.trainingSuggestions,
      overallScore: analysis.overallScore,
      rawMetrics: metrics as any,
    });

    return this.analysisRepo.save(entity);
  }

  async analyzeTraining(
    goalkeeperId: string,
    trainingSessionId: string,
    metrics: TrainingMetrics,
  ): Promise<AiAnalysis> {
    let analysis: AnalysisResult;

    if (this.gemini) {
      analysis = await this.geminiTrainingAnalysis(metrics);
    } else {
      analysis = this.generateTrainingAnalysis(metrics);
    }

    const entity = this.analysisRepo.create({
      goalkeeperId,
      trainingSessionId,
      source: AnalysisSource.TRAINING,
      strengths: analysis.strengths,
      attentionPoints: analysis.attentionPoints,
      evolutionNotes: analysis.evolutionNotes,
      trainingSuggestions: analysis.trainingSuggestions,
      overallScore: analysis.overallScore,
      rawMetrics: metrics as any,
    });

    return this.analysisRepo.save(entity);
  }

  async findByGoalkeeper(goalkeeperId: string, limit = 10): Promise<AiAnalysis[]> {
    return this.analysisRepo.find({
      where: { goalkeeperId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async findByMatch(matchId: string): Promise<AiAnalysis[]> {
    return this.analysisRepo.find({ where: { matchId }, order: { createdAt: 'DESC' } });
  }

  async findByTraining(trainingSessionId: string): Promise<AiAnalysis[]> {
    return this.analysisRepo.find({ where: { trainingSessionId }, order: { createdAt: 'DESC' } });
  }

  private async geminiMatchAnalysis(
    metrics: ScoutMetrics,
    prev?: ScoutMetrics,
  ): Promise<AnalysisResult> {
    const totalSaves =
      metrics.highSaveRight + metrics.highSaveLeft + metrics.lowSaveRight +
      metrics.lowSaveLeft + metrics.centralSave;
    const totalGoals = metrics.goalOutsideArea + metrics.goalInsideArea;
    const totalShots = totalSaves + totalGoals;
    const saveRate = totalShots > 0 ? ((totalSaves / totalShots) * 100).toFixed(1) : '0';

    const prevSummary = prev
      ? `Partida anterior: ${prev.highSaveRight + prev.highSaveLeft + prev.lowSaveRight + prev.lowSaveLeft + prev.centralSave} defesas, ${prev.goalOutsideArea + prev.goalInsideArea} gols sofridos, ${prev.interceptions} interceptações.`
      : 'Sem dados de partida anterior disponíveis.';

    const prompt = `Você é um analista especialista em goleiros de futebol. Analise as métricas abaixo de uma partida e retorne SOMENTE um JSON válido sem markdown, sem backticks, sem explicação extra.

Métricas da partida:
- Defesas altas (dir/esq): ${metrics.highSaveRight}/${metrics.highSaveLeft}
- Defesas baixas (dir/esq): ${metrics.lowSaveRight}/${metrics.lowSaveLeft}
- Defesas centrais: ${metrics.centralSave}
- Interceptações: ${metrics.interceptions}
- Distribuição pé dir/esq/mão dir: ${metrics.launchRightFoot}/${metrics.launchLeftFoot}/${metrics.launchRightHand}
- Posição base esq/dir: ${metrics.positionBaseLeft}/${metrics.positionBaseRight}
- Gols sofridos (fora/dentro da área): ${metrics.goalOutsideArea}/${metrics.goalInsideArea}
- Taxa de defesas: ${saveRate}%
${prevSummary}

Responda com este JSON:
{
  "strengths": ["string", ...],
  "attentionPoints": ["string", ...],
  "evolutionNotes": ["string", ...],
  "trainingSuggestions": ["string", ...],
  "overallScore": number (0-10)
}`;

    return this.callGemini(prompt, () => this.generateMatchAnalysis(metrics, prev));
  }

  private async geminiTrainingAnalysis(metrics: TrainingMetrics): Promise<AnalysisResult> {
    const categories = Object.entries(metrics.categoryBreakdown)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');

    const prompt = `Você é um analista especialista em treinos de goleiros de futebol. Analise as métricas abaixo de uma sessão de treino e retorne SOMENTE um JSON válido sem markdown, sem backticks, sem explicação extra.

Métricas do treino:
- Total de exercícios: ${metrics.totalExercises}
- Taxa de acerto: ${metrics.successRate.toFixed(1)}%
- Tempo médio de reação: ${metrics.avgReactionTime.toFixed(3)}s
- Categorias: ${categories || 'não informado'}

Responda com este JSON:
{
  "strengths": ["string", ...],
  "attentionPoints": ["string", ...],
  "evolutionNotes": ["string", ...],
  "trainingSuggestions": ["string", ...],
  "overallScore": number (0-10)
}`;

    return this.callGemini(prompt, () => this.generateTrainingAnalysis(metrics));
  }

  private async callGemini(
    prompt: string,
    fallback: () => AnalysisResult,
  ): Promise<AnalysisResult> {
    try {
      const model = this.gemini!.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      const parsed = JSON.parse(text) as AnalysisResult;

      return {
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
        attentionPoints: Array.isArray(parsed.attentionPoints) ? parsed.attentionPoints : [],
        evolutionNotes: Array.isArray(parsed.evolutionNotes) ? parsed.evolutionNotes : [],
        trainingSuggestions: Array.isArray(parsed.trainingSuggestions) ? parsed.trainingSuggestions : [],
        overallScore: typeof parsed.overallScore === 'number'
          ? Math.max(0, Math.min(10, parseFloat(parsed.overallScore.toFixed(2))))
          : 5.0,
      };
    } catch (err) {
      this.logger.error('Gemini API error, falling back to rule-based analysis', err);
      return fallback();
    }
  }

  private generateMatchAnalysis(metrics: ScoutMetrics, prev?: ScoutMetrics): AnalysisResult {
    const strengths: string[] = [];
    const attentionPoints: string[] = [];
    const evolutionNotes: string[] = [];
    const trainingSuggestions: string[] = [];

    const totalSaves =
      metrics.highSaveRight + metrics.highSaveLeft + metrics.lowSaveRight +
      metrics.lowSaveLeft + metrics.centralSave;
    const totalGoals = metrics.goalOutsideArea + metrics.goalInsideArea;
    const totalShots = totalSaves + totalGoals;
    const saveRate = totalShots > 0 ? (totalSaves / totalShots) * 100 : 0;

    const totalLaunches = metrics.launchRightFoot + metrics.launchLeftFoot + metrics.launchRightHand;
    const rightLaunchRate =
      totalLaunches > 0
        ? ((metrics.launchRightFoot + metrics.launchRightHand) / totalLaunches) * 100
        : 0;

    if (saveRate >= 80) strengths.push(`Excelente taxa de defesas de ${saveRate.toFixed(1)}% neste jogo.`);
    if (metrics.highSaveRight + metrics.highSaveLeft >= 4) strengths.push('Sólido desempenho em defesas altas.');
    if (metrics.lowSaveRight + metrics.lowSaveLeft >= 3) strengths.push('Eficiência notável em defesas baixas.');
    if (metrics.interceptions >= 3) strengths.push(`Destaque em interceptações com ${metrics.interceptions} ações defensivas.`);
    if (rightLaunchRate >= 75) strengths.push('Boa utilização do pé/mão dominante na distribuição.');
    if (metrics.goalOutsideArea === 0) strengths.push('Sem gols sofridos de fora da área – excelente posicionamento.');

    if (saveRate < 60) attentionPoints.push('Taxa de defesas abaixo de 60% – revisar posicionamento e tomada de decisão.');
    if (metrics.goalInsideArea >= 2) attentionPoints.push('Gols sofridos dentro da área indicam necessidade de melhora nas saídas.');
    if (metrics.launchLeftFoot > metrics.launchRightFoot && rightLaunchRate < 40) {
      attentionPoints.push('Distribuição predominantemente pelo pé não dominante – trabalhar reposição com o pé hábil.');
    }
    if (totalSaves < 2 && totalShots < 4) attentionPoints.push('Poucos chutes no jogo – dificulta avaliação completa.');

    if (prev) {
      const prevSaves =
        prev.highSaveRight + prev.highSaveLeft + prev.lowSaveRight + prev.lowSaveLeft + prev.centralSave;
      const prevGoals = prev.goalOutsideArea + prev.goalInsideArea;
      const prevRate = prevSaves + prevGoals > 0 ? (prevSaves / (prevSaves + prevGoals)) * 100 : 0;
      const diff = saveRate - prevRate;

      if (diff > 10) evolutionNotes.push(`Aumento de ${diff.toFixed(1)}% na taxa de defesas em relação à última partida.`);
      else if (diff < -10) evolutionNotes.push(`Queda de ${Math.abs(diff).toFixed(1)}% na taxa de defesas – atenção ao desempenho.`);

      const interDiff = ((metrics.interceptions - prev.interceptions) / Math.max(prev.interceptions, 1)) * 100;
      if (interDiff > 20) evolutionNotes.push(`Aumento de ${interDiff.toFixed(0)}% nas interceptações.`);
    }

    if (saveRate < 70) trainingSuggestions.push('Priorizar treinos de reflexo e posicionamento defensivo.');
    if (metrics.goalInsideArea >= 2) trainingSuggestions.push('Exercitar saídas do gol e domínio da área em situações de 1x1.');
    if (rightLaunchRate < 60) trainingSuggestions.push('Focar na distribuição com o pé e mão dominante.');
    if (trainingSuggestions.length === 0) trainingSuggestions.push('Manter os exercícios de alta intensidade e continuar o ritmo de evolução.');

    let score = 5.0;
    score += (saveRate / 100) * 3;
    score += Math.min(metrics.interceptions * 0.2, 1);
    score -= totalGoals * 0.3;
    score += rightLaunchRate > 70 ? 0.5 : 0;
    score = Math.max(0, Math.min(10, score));

    return { strengths, attentionPoints, evolutionNotes, trainingSuggestions, overallScore: parseFloat(score.toFixed(2)) };
  }

  private generateTrainingAnalysis(metrics: TrainingMetrics): AnalysisResult {
    const strengths: string[] = [];
    const attentionPoints: string[] = [];
    const evolutionNotes: string[] = [];
    const trainingSuggestions: string[] = [];

    if (metrics.successRate >= 80) strengths.push(`Taxa de acerto de ${metrics.successRate.toFixed(1)}% – desempenho excelente no treino.`);
    if (metrics.avgReactionTime > 0 && metrics.avgReactionTime < 0.5) strengths.push(`Tempo de reação de ${metrics.avgReactionTime.toFixed(3)}s está acima da média.`);
    if (metrics.totalExercises >= 5) strengths.push(`Sessão completa com ${metrics.totalExercises} exercícios realizados.`);

    if (metrics.successRate < 60) attentionPoints.push('Taxa de acerto abaixo de 60% – revisar a progressão dos exercícios.');
    if (metrics.avgReactionTime > 0.8) attentionPoints.push('Tempo de reação elevado – intensificar exercícios de velocidade e reflexo.');

    trainingSuggestions.push('Manter frequência de treinos e progressão de carga gradual.');
    if (metrics.successRate < 70) trainingSuggestions.push('Reduzir complexidade dos exercícios e trabalhar a técnica de base.');

    const score = Math.min(10, (metrics.successRate / 100) * 8 + (metrics.totalExercises >= 5 ? 2 : 1));

    return { strengths, attentionPoints, evolutionNotes, trainingSuggestions, overallScore: parseFloat(score.toFixed(2)) };
  }
}
