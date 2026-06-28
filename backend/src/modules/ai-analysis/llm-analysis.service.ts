import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

export interface AnalysisResult {
  strengths: string[];
  attentionPoints: string[];
  evolutionNotes: string[];
  trainingSuggestions: string[];
  overallScore: number;
}

/**
 * Generates goalkeeper analyses with Claude when ANTHROPIC_API_KEY is set.
 * Falls back (returns null) when disabled or on any error, so the caller can
 * use the deterministic heuristic instead — the feature degrades gracefully.
 */
@Injectable()
export class LlmAnalysisService {
  private readonly logger = new Logger(LlmAnalysisService.name);
  private client: Anthropic | null = null;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    // Default to a fast, cost-effective model for per-match analysis; override
    // with ANTHROPIC_MODEL (e.g. a higher-tier model for maximum quality).
    this.model = this.config.get<string>('ANTHROPIC_MODEL') || 'claude-sonnet-4-6';
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
      this.logger.log(`LLM analysis enabled (model: ${this.model})`);
    } else {
      this.logger.warn('ANTHROPIC_API_KEY not set – LLM analysis disabled, using heuristic');
    }
  }

  isEnabled(): boolean {
    return this.client !== null;
  }

  async analyzeMatch(metrics: any, previousMetrics?: any): Promise<AnalysisResult | null> {
    const prompt = [
      'Você é um analista de desempenho de goleiras de handebol.',
      'Analise os dados de scout desta partida e gere uma avaliação técnica em português do Brasil.',
      '',
      'Dados desta partida (scout):',
      JSON.stringify(metrics, null, 2),
      previousMetrics
        ? `\nDados da partida anterior (para comparar evolução):\n${JSON.stringify(previousMetrics, null, 2)}`
        : '',
      '',
      'Gere: pontos fortes, pontos de atenção, notas de evolução (vazio se não houver partida anterior),',
      'sugestões de treino, e uma nota geral de 0 a 10. Seja específico e use os números do scout.',
    ].join('\n');
    return this._run(prompt);
  }

  async analyzeTraining(metrics: any): Promise<AnalysisResult | null> {
    const prompt = [
      'Você é um analista de desempenho de goleiras de handebol.',
      'Analise as métricas desta sessão de treino e gere uma avaliação técnica em português do Brasil.',
      '',
      'Métricas do treino:',
      JSON.stringify(metrics, null, 2),
      '',
      'Gere: pontos fortes, pontos de atenção, notas de evolução, sugestões de treino,',
      'e uma nota geral de 0 a 10. Seja específico e baseie-se nas métricas.',
    ].join('\n');
    return this._run(prompt);
  }

  private async _run(prompt: string): Promise<AnalysisResult | null> {
    if (!this.client) return null;
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 2000,
        tools: [
          {
            name: 'submit_analysis',
            description: 'Submete a análise técnica estruturada da goleira.',
            input_schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                strengths: { type: 'array', items: { type: 'string' }, description: 'Pontos fortes observados' },
                attentionPoints: { type: 'array', items: { type: 'string' }, description: 'Pontos de atenção a melhorar' },
                evolutionNotes: { type: 'array', items: { type: 'string' }, description: 'Notas de evolução vs. período anterior (vazio se não aplicável)' },
                trainingSuggestions: { type: 'array', items: { type: 'string' }, description: 'Sugestões de treino' },
                overallScore: { type: 'number', description: 'Nota geral de 0 a 10' },
              },
              required: ['strengths', 'attentionPoints', 'evolutionNotes', 'trainingSuggestions', 'overallScore'],
            },
          },
        ],
        tool_choice: { type: 'tool', name: 'submit_analysis' },
        messages: [{ role: 'user', content: prompt }],
      });

      const block = response.content.find(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      );
      if (!block) {
        this.logger.warn('LLM returned no tool_use block; falling back to heuristic');
        return null;
      }
      const input = block.input as Partial<AnalysisResult>;
      const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
      const score = typeof input.overallScore === 'number' ? input.overallScore : 0;
      return {
        strengths: arr(input.strengths),
        attentionPoints: arr(input.attentionPoints),
        evolutionNotes: arr(input.evolutionNotes),
        trainingSuggestions: arr(input.trainingSuggestions),
        overallScore: Math.max(0, Math.min(10, parseFloat(score.toFixed(2)))),
      };
    } catch (e: any) {
      this.logger.warn(`LLM analysis failed, falling back to heuristic: ${e.message}`);
      return null;
    }
  }
}
