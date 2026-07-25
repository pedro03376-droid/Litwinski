/**
 * GK Hub — Mini-função de IA (Cloudflare Worker)
 *
 * Substitui o backend pesado só para a análise por IA. Mantém a chave da
 * Gemini SECRETA (fica no servidor da Cloudflare, nunca no app) e NÃO hiberna.
 *
 * Rotas:
 *   GET  /health    → { status: "ok" }
 *   POST /insights  → { context: {...} }  →  { analysis: "texto..." }
 *
 * Variável secreta necessária (definir no painel/CLI da Cloudflare):
 *   GEMINI_API_KEY   (pegue grátis em aistudio.google.com)
 *   GEMINI_MODEL     (opcional; padrão gemini-2.0-flash)
 *
 * Veja IA_WORKER_GEMINI.md para o passo a passo de publicação.
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
    'Com base nos dados a seguir (em JSON), escreva uma análise objetiva em português do Brasil, ' +
    'com: (1) pontos fortes, (2) pontos a desenvolver e (3) 2 a 3 recomendações de treino práticas. ' +
    'Seja conciso e evite repetir os números crus.\n\nDADOS:\n' +
    JSON.stringify(ctx || {}).slice(0, 6000)
  );
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
    if (!key) return json({ analysis: null, error: 'no_key' });   // app cai no modo heurístico

    const model = env.GEMINI_MODEL || 'gemini-2.0-flash';
    try {
      const r = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + key,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: buildPrompt(context) }] }] }),
        }
      );
      const data = await r.json();
      const text =
        (data && data.candidates && data.candidates[0] && data.candidates[0].content &&
          data.candidates[0].content.parts || [])
          .map(p => p.text || '').join('').trim();
      return json({ analysis: text || null });
    } catch (e) {
      return json({ analysis: null, error: 'gemini_failed' });
    }
  },
};
