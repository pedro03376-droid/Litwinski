/**
 * GK Hub — Mini-função de IA (Cloudflare Worker)
 *
 * Mantém a chave da Gemini SECRETA e NÃO hiberna. Devolve a análise no
 * formato ESTRUTURADO que o app espera:
 *   { analysis: { overallScore, strengths[], attentionPoints[],
 *                 evolutionNotes[], trainingSuggestions[] } }
 *
 * Rotas:
 *   GET  /health    → { status: "ok" }
 *   POST /insights  → { context: {...} }  →  { analysis: {...} }
 *
 * Variável secreta necessária (painel/CLI da Cloudflare):
 *   GEMINI_API_KEY   (grátis em aistudio.google.com)
 *   GEMINI_MODEL     (opcional; padrão gemini-2.0-flash)
 */

const ALLOW_ORIGIN = 'https://pedro03376-droid.github.io';

function cors() {
  return {
    'Access-Control-Allow-Origin': ALLOW_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', ...cors() },
  });
}

function buildPrompt(ctx) {
  return (
    'Você é um analista profissional de goleiros(as) de Futsal e Beach Soccer. ' +
    'Analise os dados (JSON) e responda SOMENTE com um JSON válido neste formato exato:\n' +
    '{\n' +
    '  "overallScore": number (0 a 10, uma casa decimal),\n' +
    '  "strengths": [string, ...],            // pontos fortes\n' +
    '  "attentionPoints": [string, ...],      // pontos a desenvolver\n' +
    '  "evolutionNotes": [string, ...],       // observações de evolução (pode ser vazio)\n' +
    '  "trainingSuggestions": [string, ...]   // 2 a 4 sugestões de treino práticas\n' +
    '}\n' +
    'Escreva em português do Brasil, objetivo, sem repetir números crus. ' +
    'Não inclua texto fora do JSON.\n\nDADOS:\n' +
    JSON.stringify(ctx || {}).slice(0, 6000)
  );
}

function coerce(obj) {
  const arr = v => Array.isArray(v) ? v.filter(x => typeof x === 'string' && x.trim()) : [];
  let score = Number(obj && obj.overallScore);
  if (!isFinite(score)) score = null;
  return {
    overallScore: score,
    strengths: arr(obj && obj.strengths),
    attentionPoints: arr(obj && obj.attentionPoints),
    evolutionNotes: arr(obj && obj.evolutionNotes),
    trainingSuggestions: arr(obj && obj.trainingSuggestions),
  };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors() });

    const url = new URL(request.url);
    if (url.pathname === '/health') return json({ status: 'ok', service: 'gkhub-ai' });

    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

    let body = {};
    try { body = await request.json(); } catch (e) {}
    const context = body.context || body || {};

    const key = env.GEMINI_API_KEY;
    if (!key) return json({ analysis: null, error: 'no_key' });

    const model = env.GEMINI_MODEL || 'gemini-2.0-flash';
    try {
      const r = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + key,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: buildPrompt(context) }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.6 },
          }),
        }
      );
      const data = await r.json();
      // Se a Gemini devolveu um erro (chave inválida, modelo, cota…), mostra o motivo.
      if (data && data.error) {
        return json({ analysis: null, error: 'gemini_error', status: r.status, detail: String((data.error && data.error.message) || '').slice(0, 400) });
      }
      let text = ((data && data.candidates && data.candidates[0] && data.candidates[0].content &&
        data.candidates[0].content.parts) || []).map(p => p.text || '').join('').trim();
      if (!text) {
        const fr = data && data.candidates && data.candidates[0] && data.candidates[0].finishReason;
        return json({ analysis: null, error: 'empty', detail: (fr ? 'finishReason=' + fr + ' ' : '') + JSON.stringify(data).slice(0, 300) });
      }
      // remove cercas de código, se houver
      text = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
      let parsed = null;
      try { parsed = JSON.parse(text); } catch (e) {
        const s = text.indexOf('{'), e2 = text.lastIndexOf('}');
        if (s >= 0 && e2 > s) { try { parsed = JSON.parse(text.slice(s, e2 + 1)); } catch (e3) {} }
      }
      if (!parsed) return json({ analysis: null, error: 'parse_failed', detail: text.slice(0, 300) });
      return json({ analysis: coerce(parsed) });
    } catch (e) {
      return json({ analysis: null, error: 'gemini_failed' });
    }
  },
};
