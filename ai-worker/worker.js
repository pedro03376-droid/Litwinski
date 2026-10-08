/**
 * GK Hub — Mini-função de IA (Cloudflare Worker) — Gemini.
 * Devolve { analysis: { overallScore, strengths[], attentionPoints[],
 *          evolutionNotes[], trainingSuggestions[] } }.
 * Tenta vários modelos automaticamente (resistente às mudanças do Google).
 * Rotas: GET /health · GET /models (requer DEBUG_TOKEN) · POST /insights
 * Secrets: GEMINI_API_KEY · (opcional) DEBUG_TOKEN · (opcional) GEMINI_MODEL
 * Binding opcional: KV "RL" (limite de uso por IP que sobrevive a reinícios).
 *
 * PROTEÇÕES (o endpoint gasta a cota paga da Gemini):
 *  - só aceita chamadas vindas das origens do GK Hub;
 *  - corpo limitado a 64 KB;
 *  - limite por IP (RATE_MAX pedidos por RATE_WINDOW segundos);
 *  - nunca devolve a mensagem de erro crua do Google ao cliente.
 */
const ALLOW_ORIGINS = [
  'https://pedro03376-droid.github.io',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
];
const MAX_BODY = 64 * 1024;   // 64 KB
const RATE_MAX = 20;          // pedidos...
const RATE_WINDOW = 3600;     // ...por hora, por IP

function pickOrigin(request) {
  const o = request.headers.get('Origin') || '';
  return ALLOW_ORIGINS.includes(o) ? o : null;
}
function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin || ALLOW_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}
function json(o, s, origin) {
  return new Response(JSON.stringify(o), {
    status: s || 200,
    headers: { 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff', ...cors(origin) },
  });
}

// Limite por IP. Usa o KV "RL" quando existir; sem ele, cai para uma contagem
// na memória do isolate — mais fraca, mas ainda segura contra loop acidental.
const _mem = new Map();
async function rateLimited(env, ip) {
  const now = Math.floor(Date.now() / 1000);
  const bucket = 'rl:' + ip + ':' + Math.floor(now / RATE_WINDOW);
  if (env && env.RL) {
    try {
      const n = parseInt((await env.RL.get(bucket)) || '0', 10) + 1;
      await env.RL.put(bucket, String(n), { expirationTtl: RATE_WINDOW + 60 });
      return n > RATE_MAX;
    } catch (e) { /* KV indisponível: não bloqueia o usuário legítimo */ }
  }
  const n = (_mem.get(bucket) || 0) + 1;
  _mem.set(bucket, n);
  if (_mem.size > 5000) _mem.clear();
  return n > RATE_MAX;
}

function buildPrompt(ctx){
  return 'Você é um analista técnico de goleiros(as) de Futsal e Beach Soccer, especialista em ciência do esporte. '
    + 'Analise os DADOS (JSON) e produza uma avaliação PRESCRITIVA e específica. Use, quando presentes: '
    + 'gkRating/nivelForma/tendencia/projecao6Semanas (forma atual), golsEvitados/golsEsperados (GSAA — desempenho vs esperado), '
    + 'defesasPorZona e golsPorOrigem (identifique a ZONA MAIS FRÁGIL e cite-a), precisaoDistribuicaoPct, interceptacoes/saidasDoGol (comando de área), '
    + 'tempoReacaoMs (reflexo/decisão) e dimensoesIGD. '
    + 'Regras: seja concreto (cite números e a zona/origem específica); trainingSuggestions devem ser EXERCÍCIOS acionáveis (o quê, foco e volume), não conselhos genéricos; adapte à modalidade e ao naipe. '
    + 'Responda SOMENTE com JSON válido no formato: {"overallScore":number,"strengths":[string],"attentionPoints":[string],"evolutionNotes":[string],"trainingSuggestions":[string]}. Em português do Brasil. Sem texto fora do JSON.\n\nDADOS:\n'
    + JSON.stringify(ctx||{}).slice(0,6000);
}
function coerce(obj){const arr=v=>Array.isArray(v)?v.filter(x=>typeof x==='string'&&x.trim()):[];let s=Number(obj&&obj.overallScore);if(!isFinite(s))s=null;return{overallScore:s,strengths:arr(obj&&obj.strengths),attentionPoints:arr(obj&&obj.attentionPoints),evolutionNotes:arr(obj&&obj.evolutionNotes),trainingSuggestions:arr(obj&&obj.trainingSuggestions)};}

// Busca a lista viva de modelos da conta (só os que fazem generateContent),
// já ordenada com os "flash" na frente (mais rápidos/baratos).
async function listLiveModels(key){
  try{
    const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models?key='+key);
    const d=await r.json();
    if(d&&d.error) return [];
    const names=(d.models||[])
      .filter(m=>(m.supportedGenerationMethods||[]).includes('generateContent'))
      .map(m=>m.name.replace('models/',''))
      // evita modelos pesados/experimentais de raciocínio por padrão
      .filter(n=>!/embedding|aqa|vision|thinking/i.test(n));
    const score=n=>{ let s=0; if(/flash/i.test(n))s-=4; if(/latest/i.test(n))s-=2; if(/2\.5|2\.0/i.test(n))s-=1; if(/pro/i.test(n))s+=1; return s; };
    return names.sort((a,b)=>score(a)-score(b));
  }catch(e){ return []; }
}

async function callModel(model, key, prompt){
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent?key='+key,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{responseMimeType:'application/json',temperature:0.6}})
  });
  const data = await r.json();
  if (data && data.error) return {ok:false,status:r.status,detail:String((data.error&&data.error.message)||'').slice(0,200),model};
  let text=((data&&data.candidates&&data.candidates[0]&&data.candidates[0].content&&data.candidates[0].content.parts)||[]).map(p=>p.text||'').join('').trim();
  if(!text) return {ok:false,status:r.status,detail:'empty',model};
  text=text.replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();
  let parsed=null; try{parsed=JSON.parse(text);}catch(e){const a=text.indexOf('{'),b=text.lastIndexOf('}');if(a>=0&&b>a){try{parsed=JSON.parse(text.slice(a,b+1));}catch(e2){}}}
  if(!parsed) return {ok:false,status:r.status,detail:'parse_failed',model};
  return {ok:true,analysis:coerce(parsed),model};
}

export default {
  async fetch(request, env){
    const origin = pickOrigin(request);
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      if (!origin) return new Response(null, { status: 403 });
      return new Response(null, { headers: cors(origin) });
    }

    // /health não revela nada e serve de ping para o app.
    if (url.pathname === '/health') return json({status:'ok',service:'gkhub-ai'}, 200, origin);

    // /models é diagnóstico: expõe a configuração da conta, então fica atrás
    // de um segredo (npx wrangler secret put DEBUG_TOKEN).
    if (url.pathname === '/models'){
      const tok = url.searchParams.get('token') || '';
      if (!env.DEBUG_TOKEN || tok !== env.DEBUG_TOKEN) return json({error:'not_found'}, 404, origin);
      const key = env.GEMINI_API_KEY;
      if(!key) return json({error:'no_key'}, 500, origin);
      const names = await listLiveModels(key);
      return json({count:names.length,models:names}, 200, origin);
    }

    if (request.method !== 'POST') return json({error:'method_not_allowed'},405,origin);

    // A partir daqui gasta cota paga: exige origem conhecida.
    if (!origin) return json({error:'forbidden'}, 403, null);

    const ip = request.headers.get('CF-Connecting-IP') || 'desconhecido';
    if (await rateLimited(env, ip)) {
      return json({analysis:null,error:'rate_limited',
        message:'Muitas análises em pouco tempo. Tente de novo mais tarde.'}, 429, origin);
    }

    const len = parseInt(request.headers.get('Content-Length') || '0', 10);
    if (len > MAX_BODY) return json({error:'payload_too_large'}, 413, origin);
    const raw = await request.text();
    if (raw.length > MAX_BODY) return json({error:'payload_too_large'}, 413, origin);

    let body={}; try{ body=JSON.parse(raw); }catch(e){}
    const context = (body && body.context) || body || {};
    const key = env.GEMINI_API_KEY;
    if (!key) return json({analysis:null,error:'no_key'}, 500, origin);

    // Tenta o modelo configurado (se houver) e depois uma lista de candidatos.
    const candidates=[];
    if(env.GEMINI_MODEL) candidates.push(env.GEMINI_MODEL);
    ['gemini-flash-latest','gemini-2.0-flash','gemini-2.0-flash-001','gemini-1.5-flash','gemini-1.5-flash-latest','gemini-pro-latest'].forEach(m=>{if(!candidates.includes(m))candidates.push(m);});
    const prompt = buildPrompt(context);
    let last=null; const tried=[];
    const tryList = async (models) => {
      for (const model of models){
        if (tried.includes(model)) continue; tried.push(model);
        try{ const res=await callModel(model,key,prompt); if(res.ok) return {analysis:res.analysis,model:res.model}; last=res; }
        catch(e){ last={ok:false,detail:String(e).slice(0,150),model}; }
      }
      return null;
    };
    // 1) caminho rápido: modelos fixos conhecidos
    let hit = await tryList(candidates);
    if (hit) return json(hit, 200, origin);
    // 2) auto-cura: descobre os modelos REAIS da conta e tenta de novo
    const live = await listLiveModels(key);
    hit = await tryList(live);
    if (hit) return json(hit, 200, origin);

    // O detalhe do Google pode conter o nome do projeto, cota e configuração:
    // fica no log do Worker (npx wrangler tail), não na resposta.
    console.log('gemini_falhou', JSON.stringify({ tried, last }));
    return json({analysis:null,error:'all_models_failed',
      message:'A análise por IA está indisponível no momento.'}, 502, origin);
  }
};
