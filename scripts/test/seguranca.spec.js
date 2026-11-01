/*
 * Injeção — protege as três falhas reais encontradas no pentest.
 * Cada caso aqui JÁ executou em produção antes de ser corrigido, então
 * não é teste defensivo teórico: é cerca em volta de buraco conhecido.
 */
const playwright = require('playwright');
const { abrirNavegador, abrirApp, navegar, criarChecks } = require('./harness');

const NOME_HTML   = '<img src=x onerror="window.__XSS=1">';
const NOME_ATRIB  = '" onmouseover="window.__XSS_ATTR=1" x="';
const ESCUDO_MAU  = 'x" onerror="window.__XSS_ESCUDO=1" data-y="';

module.exports = async function () {
  const ok = criarChecks();
  const browser = await abrirNavegador(playwright);
  try {
    const { page, erros } = await abrirApp(browser);

    // ── 1. Nome de goleira não vira HTML (corrigido no v164) ──
    const r1 = await page.evaluate((n) => {
      DB.saveGoleiras([{ id: 'x1', nome: n, modalidade: 'futsal', naipe: 'feminino' }]);
      DB.savePartidas([{ id: 'q1', data: '2026-01-01', adversario: n, competicao: n,
                         goalkeeperId: 'x1', gf: 1, gc: 0 }]);
      try { navigate('partidas'); } catch (e) {}
      return { xss: !!window.__XSS, tagInjetada: !!document.querySelector('#page-partidas img[src="x"]') };
    }, NOME_HTML);
    ok('nome com HTML não executa nem injeta tag', !r1.xss && !r1.tagInjetada, JSON.stringify(r1));

    // ── 2. Linha do tempo do Match Center (corrigido no v173) ──
    const r2 = await page.evaluate(({ a, b }) => {
      mcLog.length = 0;
      mcLog.unshift({ key: '_sub', label: '🔄 Entra: ' + a, tipo: 'sub', time: '05:00', periodo: 1, sec: 300 });
      mcLog.unshift({ key: '_sub', label: '🔄 Entra: ' + b, tipo: 'sub', time: '06:00', periodo: 1, sec: 360 });
      try { mcUpdateLog(); } catch (e) { return { erro: String(e.message) }; }
      document.querySelectorAll('.mc-timeline-item').forEach((el) =>
        el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })));
      return { xss: !!window.__XSS, attr: !!window.__XSS_ATTR,
               tagInjetada: !!document.querySelector('.mc-timeline-item img[src="x"]') };
    }, { a: NOME_HTML, b: NOME_ATRIB });
    ok('substituição de goleira no log não executa código',
       !r2.erro && !r2.xss && !r2.attr && !r2.tagInjetada, JSON.stringify(r2));

    // ── 3. Escudo/foto que não é imagem (corrigido no v174) ──
    const r3 = await page.evaluate((carga) => {
      const s = clubSettings(); s.escudo = carga;
      localStorage.setItem('gkhub_club_settings', JSON.stringify(s));
      try { applyClubBranding(); } catch (e) {}
      return { xss: !!window.__XSS_ESCUDO,
               tagInjetada: !!document.querySelector('img[src="x"]'),
               filtro_png: _imgSrc('data:image/png;base64,AAA') === 'data:image/png;base64,AAA',
               filtro_carga: _imgSrc(carga) === '',
               filtro_js: _imgSrc('javascript:alert(1)') === '' };
    }, ESCUDO_MAU);
    ok('escudo malicioso não executa', !r3.xss && !r3.tagInjetada, JSON.stringify(r3));
    ok('filtro de imagem: aceita data:image, recusa o resto',
       r3.filtro_png && r3.filtro_carga && r3.filtro_js, JSON.stringify(r3));

    // ── 4. Injeção de fórmula na planilha (corrigido no v173) ──
    const r4 = await page.evaluate(() => {
      const cargas = ['=1+1', '+1', '-1', '@SUM(1)', '=HYPERLINK("http://x","c")'];
      // _csvValor é o ponto único por onde todo campo passa
      return cargas.map((c) => _csvValor(c)).map((s) => s.replace(/^"|"$/g, ''));
    });
    const perigosos = r4.filter((v) => /^[=+\-@\t\r]/.test(v));
    ok('campos de planilha não começam com = + - @', perigosos.length === 0, JSON.stringify(perigosos));

    ok('sem erro de JavaScript durante os ataques', erros.length === 0, erros.join(' | '));
  } finally {
    await browser.close();
  }
  return ok;
};
