import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

export interface AnalysisResult {
  strengths: string[];
  attentionPoints: string[];
  evolutionNotes: string[];
  trainingSuggestions: string[];
  overallScore: number;
}

type Provider = 'anthropic' | 'gemini' | null;

/**
 * Generates goalkeeper analyses with an LLM when a provider key is set.
 * Provider priority: Anthropic (ANTHROPIC_API_KEY) → Gemini (GEMINI_API_KEY).
 * Falls back (returns null) when disabled or on any error, so the caller can
 * use the deterministic heuristic instead — the feature degrades gracefully.
 */
@Injectable()
export class LlmAnalysisService {
  private readonly logger = new Logger(LlmAnalysisService.name);
  private provider: Provider = null;
  private anthropic: Anthropic | null = null;
  private gemini: GoogleGenerativeAI | null = null;
  private model = '';

  constructor(private readonly config: ConfigService) {
    const anthropicKey = this.config.get<string>('ANTHROPIC_API_KEY');
    const geminiKey = this.config.get<string>('GEMINI_API_KEY');

    if (anthropicKey) {
      this.provider = 'anthropic';
      this.anthropic = new Anthropic({ apiKey: anthropicKey });
      this.model = this.config.get<string>('ANTHROPIC_MODEL') || 'claude-sonnet-4-6';
      this.logger.log(`LLM analysis enabled (anthropic, model: ${this.model})`);
    } else if (geminiKey) {
      this.provider = 'gemini';
      this.gemini = new GoogleGenerativeAI(geminiKey);
      this.model = this.config.get<string>('GEMINI_MODEL') || 'gemini-2.0-flash';
      this.logger.log(`LLM analysis enabled (gemini, model: ${this.model})`);
    } else {
      this.logger.warn('No LLM key set – LLM analysis disabled, using heuristic');
    }
  }

  isEnabled(): boolean {
    return this.provider !== null;
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

  /**
   * Stateless goalkeeper analysis from an arbitrary context object (stats,
   * IGD, recent form, distribution, weaknesses). Used by the web app, whose
   * data lives client-side. Returns null when disabled/on error so the caller
   * can fall back to its own heuristic insights.
   */
  async analyzeGoalkeeper(context: any): Promise<AnalysisResult | null> {
    const prompt = [
      'Você é um analista de desempenho especializado em GOLEIRAS/GOLEIROS de FUTSAL.',
      'Analise os dados abaixo e produza uma avaliação técnica objetiva em português do Brasil,',
      'considerando a especificidade do futsal (quadra reduzida, muitos chutes de curta distância,',
      'importância da distribuição/saída de bola, jogo de 1x1) e o naipe informado.',
      '',
      'Dados da atleta (agregados do sistema):',
      JSON.stringify(context, null, 2),
      '',
      'Gere, com base nos NÚMEROS fornecidos (seja específico e cite valores):',
      '- strengths: pontos fortes.',
      '- attentionPoints: pontos a desenvolver.',
      '- evolutionNotes: tendências de evolução (vazio se não houver base de comparação).',
      '- trainingSuggestions: sugestões de treino práticas e específicas para futsal.',
      '- overallScore: nota geral de 0 a 10.',
    ].join('\n');
    return this._run(prompt);
  }

  private async _run(prompt: string): Promise<AnalysisResult | null> {
    try {
      if (this.provider === 'anthropic') return await this._runAnthropic(prompt);
      if (this.provider === 'gemini') return await this._runGemini(prompt);
      return null;
    } catch (e: any) {
      this.logger.warn(`LLM analysis failed, falling back to heuristic: ${e.message}`);
      return null;
    }
  }

  private _normalize(input: Partial<AnalysisResult>): AnalysisResult {
    const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
    const score = typeof input.overallScore === 'number' ? input.overallScore : 0;
    return {
      strengths: arr(input.strengths),
      attentionPoints: arr(input.attentionPoints),
      evolutionNotes: arr(input.evolutionNotes),
      trainingSuggestions: arr(input.trainingSuggestions),
      overallScore: Math.max(0, Math.min(10, parseFloat(score.toFixed(2)))),
    };
  }

  private async _runAnthropic(prompt: string): Promise<AnalysisResult | null> {
    const response = await this.anthropic!.messages.create({
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
              evolutionNotes: { type: 'array', items: { type: 'string' }, description: 'Notas de evolução (vazio se não aplicável)' },
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
    if (!block) return null;
    return this._normalize(block.input as Partial<AnalysisResult>);
  }

  private async _runGemini(prompt: string): Promise<AnalysisResult | null> {
    const model = this.gemini!.getGenerativeModel({
      model: this.model,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            strengths: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
            attentionPoints: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
            evolutionNotes: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
            trainingSuggestions: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
            overallScore: { type: SchemaType.NUMBER },
          },
          required: ['strengths', 'attentionPoints', 'evolutionNotes', 'trainingSuggestions', 'overallScore'],
        },
      },
    });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    if (!text) return null;
    return this._normalize(JSON.parse(text) as Partial<AnalysisResult>);
  }
}
