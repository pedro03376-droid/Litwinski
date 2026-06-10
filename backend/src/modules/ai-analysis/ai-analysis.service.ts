import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiAnalysis, AnalysisSource } from './entities/ai-analysis.entity';
import { ConfigService } from '@nestjs/config';

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

@Injectable()
export class AiAnalysisService {
  constructor(
    @InjectRepository(AiAnalysis)
    private readonly analysisRepo: Repository<AiAnalysis>,
    private readonly configService: ConfigService,
  ) {}

  async analyzeMatch(
    goalkeeperId: string,
    matchId: string,
    metrics: ScoutMetrics,
    previousMetrics?: ScoutMetrics,
  ): Promise<AiAnalysis> {
    const analysis = this.generateMatchAnalysis(metrics, previousMetrics);

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
    const analysis = this.generateTrainingAnalysis(metrics);

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

  private generateMatchAnalysis(
    metrics: ScoutMetrics,
    prev?: ScoutMetrics,
  ): { strengths: string[]; attentionPoints: string[]; evolutionNotes: string[]; trainingSuggestions: string[]; overallScore: number } {
    const strengths: string[] = [];
    const attentionPoints: string[] = [];
    const evolutionNotes: string[] = [];
    const trainingSuggestions: string[] = [];

    const totalSaves = metrics.highSaveRight + metrics.highSaveLeft + metrics.lowSaveRight + metrics.lowSaveLeft + metrics.centralSave;
    const totalGoals = metrics.goalOutsideArea + metrics.goalInsideArea;
    const totalShots = totalSaves + totalGoals;
    const saveRate = totalShots > 0 ? (totalSaves / totalShots) * 100 : 0;

    const totalLaunches = metrics.launchRightFoot + metrics.launchLeftFoot + metrics.launchRightHand;
    const rightLaunchRate = totalLaunches > 0 ? ((metrics.launchRightFoot + metrics.launchRightHand) / totalLaunches) * 100 : 0;

    // Strengths
    if (saveRate >= 80) strengths.push(`Excelente taxa de defesas de ${saveRate.toFixed(1)}% neste jogo.`);
    if (metrics.highSaveRight + metrics.highSaveLeft >= 4) strengths.push('Sólido desempenho em defesas altas.');
    if (metrics.lowSaveRight + metrics.lowSaveLeft >= 3) strengths.push('Eficiência notável em defesas baixas.');
    if (metrics.interceptions >= 3) strengths.push(`Destaque em interceptações com ${metrics.interceptions} ações defensivas.`);
    if (rightLaunchRate >= 75) strengths.push('Boa utilização do pé/mão dominante na distribuição.');
    if (metrics.goalOutsideArea === 0) strengths.push('Sem gols sofridos de fora da área – excelente posicionamento.');

    // Attention points
    if (saveRate < 60) attentionPoints.push('Taxa de defesas abaixo de 60% – revisar posicionamento e tomada de decisão.');
    if (metrics.goalInsideArea >= 2) attentionPoints.push('Gols sofridos dentro da área indicam necessidade de melhora nas saídas.');
    if (metrics.launchLeftFoot > metrics.launchRightFoot && rightLaunchRate < 40) {
      attentionPoints.push('Distribuição predominantemente pelo pé não dominante – trabalhar reposição com o pé hábil.');
    }
    if (totalSaves < 2 && totalShots < 4) attentionPoints.push('Poucos chutes no jogo – dificulta avaliação completa.');

    // Evolution notes
    if (prev) {
      const prevSaves = prev.highSaveRight + prev.highSaveLeft + prev.lowSaveRight + prev.lowSaveLeft + prev.centralSave;
      const prevGoals = prev.goalOutsideArea + prev.goalInsideArea;
      const prevRate = (prevSaves + prevGoals) > 0 ? (prevSaves / (prevSaves + prevGoals)) * 100 : 0;
      const diff = saveRate - prevRate;

      if (diff > 10) evolutionNotes.push(`Aumento de ${diff.toFixed(1)}% na taxa de defesas em relação à última partida.`);
      else if (diff < -10) evolutionNotes.push(`Queda de ${Math.abs(diff).toFixed(1)}% na taxa de defesas – atenção ao desempenho.`);

      const prevInterceptions = prev.interceptions;
      const interDiff = ((metrics.interceptions - prevInterceptions) / Math.max(prevInterceptions, 1)) * 100;
      if (interDiff > 20) evolutionNotes.push(`Aumento de ${interDiff.toFixed(0)}% nas interceptações.`);
    }

    // Training suggestions
    if (saveRate < 70) {
      trainingSuggestions.push('Priorizar treinos de reflexo e posicionamento defensivo.');
    }
    if (metrics.goalInsideArea >= 2) {
      trainingSuggestions.push('Exercitar saídas do gol e domínio da área em situações de 1x1.');
    }
    if (rightLaunchRate < 60) {
      trainingSuggestions.push('Focar na distribuição com o pé e mão dominante.');
    }
    if (trainingSuggestions.length === 0) {
      trainingSuggestions.push('Manter os exercícios de alta intensidade e continuar o ritmo de evolução.');
    }

    // Score
    let score = 5.0;
    score += (saveRate / 100) * 3;
    score += Math.min(metrics.interceptions * 0.2, 1);
    score -= totalGoals * 0.3;
    score += rightLaunchRate > 70 ? 0.5 : 0;
    score = Math.max(0, Math.min(10, score));

    return { strengths, attentionPoints, evolutionNotes, trainingSuggestions, overallScore: parseFloat(score.toFixed(2)) };
  }

  private generateTrainingAnalysis(
    metrics: TrainingMetrics,
  ): { strengths: string[]; attentionPoints: string[]; evolutionNotes: string[]; trainingSuggestions: string[]; overallScore: number } {
    const strengths: string[] = [];
    const attentionPoints: string[] = [];
    const evolutionNotes: string[] = [];
    const trainingSuggestions: string[] = [];

    if (metrics.successRate >= 80) {
      strengths.push(`Taxa de acerto de ${metrics.successRate.toFixed(1)}% – desempenho excelente no treino.`);
    }
    if (metrics.avgReactionTime > 0 && metrics.avgReactionTime < 0.5) {
      strengths.push(`Tempo de reação de ${metrics.avgReactionTime.toFixed(3)}s está acima da média.`);
    }
    if (metrics.totalExercises >= 5) {
      strengths.push(`Sessão completa com ${metrics.totalExercises} exercícios realizados.`);
    }

    if (metrics.successRate < 60) {
      attentionPoints.push('Taxa de acerto abaixo de 60% – revisar a progressão dos exercícios.');
    }
    if (metrics.avgReactionTime > 0.8) {
      attentionPoints.push('Tempo de reação elevado – intensificar exercícios de velocidade e reflexo.');
    }

    trainingSuggestions.push('Manter frequência de treinos e progressão de carga gradual.');
    if (metrics.successRate < 70) {
      trainingSuggestions.push('Reduzir complexidade dos exercícios e trabalhar a técnica de base.');
    }

    const score = Math.min(10, (metrics.successRate / 100) * 8 + (metrics.totalExercises >= 5 ? 2 : 1));

    return { strengths, attentionPoints, evolutionNotes, trainingSuggestions, overallScore: parseFloat(score.toFixed(2)) };
  }
}
