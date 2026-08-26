/**
 * GK Hub — Mini-função de IA (Cloudflare Worker) — Gemini.
 * Devolve { analysis: { overallScore, strengths[], attentionPoints[],
 *          evolutionNotes[], trainingSuggestions[] } }.
 * Tenta vários modelos automaticamente (resistente às mudanças do Google).
 * Rotas: GET /health · GET /models (lista os modelos da sua conta) · POST /insights
 * Secret: GEMINI_API_KEY · (opcional) GEMINI_MODEL
 */
const ALLOW_ORIGIN = 'https://pedro03376-droid.github.io';
function cors(){return{'Access-Control-Allow-Origin':ALLOW_ORIGIN,'Access-Control-Allow-Methods':'POST, GET, OPTIONS','Access-Control-Allow-Headers':'Content-Type'};}
function json(o,s){return new Response(JSON.stringify(o),{status:s||200,headers:{'Content-Type':'application/json',...cors()}});}
function buildPrompt(ctx){
  return 'Você é um analista de goleiros(as) de Futsal e Beach Soccer. Analise os dados (JSON) e responda SOMENTE com JSON válido no formato: {"overallScore":number,"strengths":[string],"attentionPoints":[string],"evolutionNotes":[string],"trainingSuggestions":[string]}. Em português do Brasil. Sem texto fora do JSON.\n\nDADOS:\n'+JSON.stringify(ctx||{}).slice(0,6000);
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
    if (request.method === 'OPTIONS') return new Response(null,{headers:cors()});
    const url = new URL(request.url);
    const key = env.GEMINI_API_KEY;
    if (url.pathname === '/health') return json({status:'ok',service:'gkhub-ai'});
    if (url.pathname === '/models'){
      if(!key) return json({error:'no_key'});
      try{ const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models?key='+key); const d=await r.json();
        if(d&&d.error) return json({error:'gemini_error',detail:String(d.error.message||'').slice(0,300)});
        const names=(d.models||[]).filter(m=>(m.supportedGenerationMethods||[]).includes('generateContent')).map(m=>m.name.replace('models/',''));
        return json({count:names.length,models:names});
      }catch(e){ return json({error:'fetch_failed',detail:String(e).slice(0,200)}); }
    }
    if (request.method !== 'POST') return json({error:'method_not_allowed'},405);
    let body={}; try{ body=await request.json(); }catch(e){}
    const context = body.context || body || {};
    if (!key) return json({analysis:null,error:'no_key'});
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
    if (hit) return json(hit);
    // 2) auto-cura: descobre os modelos REAIS da conta e tenta de novo
    const live = await listLiveModels(key);
    hit = await tryList(live);
    if (hit) return json(hit);
    return json({analysis:null,error:'all_models_failed',detail:last,tried});
  }
};
