/*
 * Base comum dos testes do GK Hub.
 *
 * Existe por dois motivos. O primeiro é não repetir o mesmo preâmbulo de
 * Playwright em uma dúzia de arquivos. O segundo é uma lição concreta: a
 * suíte anterior vivia num diretório temporário e apontava para um caminho
 * fixo do Chromium — o ambiente foi reconstruído, os arquivos sumiram e o
 * caminho mudou de versão. Aqui o navegador é descoberto, não presumido,
 * e os testes moram no repositório.
 */
const path = require('path');
const fs = require('fs');

const RAIZ = path.resolve(__dirname, '..', '..');
const FRONTEND = path.join(RAIZ, 'frontend');
const APP_URL = 'file://' + path.join(FRONTEND, 'index.html');

// A versão dos termos é lida do app.js, não escrita à mão. Quando estava
// fixa no teste e o app subiu para 2026-10.2, o teste passou a rodar com o
// aviso de aceite na frente — as páginas até apareciam, mas nada atrás do
// modal estava sendo verificado de verdade.
const LEGAL_VERSION = (function () {
  const m = fs.readFileSync(path.join(FRONTEND, 'app.js'), 'utf8')
    .match(/const LEGAL_VERSION = '([^']+)'/);
  if (!m) throw new Error('não achei LEGAL_VERSION em app.js — o seed abriria com o aviso de aceite na frente');
  return m[1];
})();

/* ── Navegador ───────────────────────────────────────────────────────── */

// Tenta o navegador que o Playwright gerencia; se a versão instalada não
// casar com a da biblioteca (acontece em container pré-montado), procura
// qualquer Chromium disponível em vez de falhar.
async function abrirNavegador(playwright) {
  const { chromium } = playwright;
  try {
    return await chromium.launch();
  } catch (e) {
    const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
    const candidatos = [];
    try {
      for (const dir of fs.readdirSync(base)) {
        if (!/^chromium-/.test(dir)) continue;
        for (const sub of ['chrome-linux64/chrome', 'chrome-linux/chrome']) {
          const p = path.join(base, dir, sub);
          if (fs.existsSync(p)) candidatos.push(p);
        }
      }
    } catch (_) { /* diretório não existe: cai no erro original */ }
    if (!candidatos.length) throw e;
    candidatos.sort();   // versão mais alta por último
    return await chromium.launch({ executablePath: candidatos[candidatos.length - 1] });
  }
}

/* ── Dados de teste ──────────────────────────────────────────────────── */

// Estado de um clube em uso: sessão válida, consentimento dado, elenco e
// jogos. Serve de ponto de partida para quase todo teste.
// Atenção: addInitScript serializa a FONTE da função e a avalia na página,
// então ela não leva consigo nenhuma variável de fora. Tudo o que ela precisa
// entra pelo argumento `o`. (Custou um "o is not defined" para aprender.)
function semente(opcoes = {}) {
  const o = Object.assign({ goleiras: 4, partidas: 12, scoutsPorPartida: 2,
                            legal: LEGAL_VERSION }, opcoes);
  return { arg: o, fn: function (o) {
    // Chart.js é carregado de vendor/, mas em file:// nem sempre resolve;
    // o stub mantém o teste determinístico e sem dependência externa.
    if (!window.Chart) {
      const S = function () {};
      S.prototype.destroy = S.prototype.update = S.prototype.resize = function () {};
      S.defaults = { font: {}, color: '', animation: {}, animations: {},
                     plugins: { legend: { labels: {} }, tooltip: {} } };
      window.Chart = S;
    }
    // Sorteio com semente fixa, de propósito. Com Math.random o conjunto de
    // dados mudava a cada execução e o axe acusava violação de contraste em
    // uma execução de três — a cor do destaque depende de quem foi destacado.
    // Teste instável é pior que teste nenhum: ou a falha é reproduzível, ou
    // ninguém vai acreditar nela.
    let _s = o.semente || 20260101;
    const r = (n) => { _s = (_s * 1103515245 + 12345) & 0x7fffffff; return Math.floor((_s / 0x7fffffff) * n); };
    const rnd = () => { _s = (_s * 1103515245 + 12345) & 0x7fffffff; return _s / 0x7fffffff; };
    localStorage.setItem('gkhub_session', JSON.stringify({ token: 't', user: 'CI', expiresAt: Date.now() + 9e11 }));
    localStorage.setItem('gkhub_legal', JSON.stringify({ v: o.legal, at: new Date().toISOString() }));
    // O tema NÃO segue prefers-color-scheme: é a classe body.theme-light,
    // vinda desta preferência. Passar colorScheme ao Playwright não mudava
    // nada, e a suíte rodava "claro" medindo o escuro duas vezes.
    if (o.tema) localStorage.setItem('gkhub_prefs', JSON.stringify({ theme: o.tema, color: 'blue' }));
    localStorage.setItem('gkhub_onboarded', '1');
    localStorage.setItem('gkhub_welcome_seen', '1');
    localStorage.setItem('gkhub_club_settings', JSON.stringify({ nome: 'Clube CI', display: 'Clube CI' }));

    const nomes = ['Mônica Alves', 'Beatriz Rocha', 'Letícia Santos', 'Carolina Dias',
                   'Fernanda Lima', 'Gabriela Souza', 'Ana Paz', 'Júlia Reis'];
    const gks = [], partidas = [], scouts = [];
    for (let i = 0; i < o.goleiras; i++) {
      gks.push({ id: 'gk' + i, nome: nomes[i % nomes.length], modalidade: i % 2 ? 'beach' : 'futsal',
        naipe: 'feminino', equipe: 'Clube CI', categoria: ['Sub-17', 'Sub-20', 'Adulto'][i % 3],
        nascimento: '2006-03-14', altura: 168 + r(12), peso: 60 + r(12), pe: 'Destro' });
    }
    const advs = ['Corinthians', 'Palmeiras', 'São Paulo', 'Santos', 'Portuguesa'];
    for (let i = 0; i < o.partidas; i++) {
      const gk = gks[r(gks.length)] || { id: 'gk0', modalidade: 'futsal' };
      const d = new Date(Date.now() - i * 5 * 864e5).toISOString().slice(0, 10);
      partidas.push({ id: 'p' + i, data: d, adversario: advs[i % advs.length],
        competicao: ['Paulista', 'Copa SP', 'Liga'][i % 3], local: i % 2 ? 'casa' : 'fora',
        goalkeeperId: gk.id, gf: r(5), gc: r(4), modalidade: gk.modalidade });
      for (let s = 0; s < o.scoutsPorPartida; s++) {
        scouts.push({ id: 'p' + i + '-s' + s, partidaId: 'p' + i, goalkeeperId: gk.id, data: d,
          periodo: s + 1, dad: r(4), dae: r(4), dbd: r(3), dbe: r(3), dc: r(3), d1x1: r(4),
          gda: r(2), gfa: r(1), int: r(5), sai: r(4), dpc: r(9), dpe: r(2), dmc: r(6), dme: r(2),
          pose: r(4), posd: r(4), nota: (5 + rnd() * 4).toFixed(1) });
      }
    }
    localStorage.setItem('gkhub_goleiras', JSON.stringify(gks));
    localStorage.setItem('gkhub_partidas', JSON.stringify(partidas));
    localStorage.setItem('gkhub_scouts', JSON.stringify(scouts));
  } };
}

/* ── Abrir o app ─────────────────────────────────────────────────────── */

// Devolve { page, erros } com o app carregado. `erros` acumula exceções de
// JavaScript — qualquer teste pode afirmar que ficou vazio.
// `semear` aceita { fn, arg } (o que semente() devolve) ou uma função sem
// argumento. Ver a nota em semente(): a função roda isolada na página.
async function abrirApp(browser, { viewport, semear, colorScheme, reducedMotion } = {}) {
  const page = await browser.newPage({
    viewport: viewport || { width: 1280, height: 900 },
    colorScheme, reducedMotion,
  });
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e.message).split('\n')[0].slice(0, 160)));

  // Nada de rede nos testes: o app é local-first e a nuvem é opcional.
  // Sem isto o proxy do ambiente devolve 401 e enche o log de ruído.
  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith('file:')) return route.continue();
    return route.fulfill({ status: 204, body: '' });
  });

  const s = semear || semente();
  if (typeof s === 'function') await page.addInitScript(s);
  else await page.addInitScript(s.fn, s.arg);

  await page.goto(APP_URL);
  await page.waitForTimeout(1200);
  return { page, erros };
}

async function navegar(page, pagina, esperaMs = 220) {
  await page.evaluate((p) => { try { navigate(p); } catch (e) {} }, pagina);
  await page.waitForTimeout(esperaMs);
}

// Espera o layout assentar. Sem isso, medições de cor e tamanho pegam o
// meio da animação de entrada e inventam problemas que não existem — foi
// o que aconteceu na auditoria de acessibilidade.
async function assentar(page, ms = 450) {
  await page.waitForTimeout(ms);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

/* ── Afirmações ──────────────────────────────────────────────────────── */

function criarChecks() {
  const itens = [];
  const ok = (nome, condicao, detalhe) => { itens.push({ nome, passou: !!condicao, detalhe: detalhe || '' }); };
  ok.itens = itens;
  ok.falhas = () => itens.filter((i) => !i.passou);
  ok.relatar = () => {
    for (const i of itens) {
      console.log((i.passou ? '  ✓ ' : '  ✗ ') + i.nome + (i.passou || !i.detalhe ? '' : '\n        → ' + i.detalhe));
    }
    return ok.falhas().length;
  };
  return ok;
}

const PAGINAS = ['dashboard', 'executivo', 'goleiras', 'perfil', 'comparacao', 'matchcenter',
  'partidas', 'scout', 'performance', 'treinos', 'heatmap', 'penaltis', 'periodizacao',
  'relatorios', 'central-relatorios', 'notificacoes', 'auditoria', 'clube', 'lesoes', 'pid'];

module.exports = { RAIZ, FRONTEND, APP_URL, PAGINAS, LEGAL_VERSION,
  abrirNavegador, abrirApp, navegar, assentar, semente, criarChecks };
