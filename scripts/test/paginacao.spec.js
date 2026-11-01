/*
 * Paginação e cache — as duas otimizações que mudaram o comportamento.
 *
 * Otimização que entrega resultado errado é pior que app lento, e as duas
 * aqui têm esse risco: a paginação pode esconder linha que existe, e o cache
 * do DB pode servir dado velho depois de salvar. Os dois casos são cobertos.
 */
const playwright = require('playwright');
const { abrirNavegador, abrirApp, navegar, criarChecks, semente } = require('./harness');

module.exports = async function () {
  const ok = criarChecks();
  const browser = await abrirNavegador(playwright);
  try {
    // 240 partidas: acima do passo de 50, para a paginação entrar em ação.
    const { page, erros } = await abrirApp(browser, {
      semear: semente({ goleiras: 6, partidas: 240, scoutsPorPartida: 2 }),
    });

    const passo = await page.evaluate(() => _PG_STEP);
    ok('o passo da paginação é um número razoável', passo >= 20 && passo <= 100, String(passo));

    // ── Partidas ─────────────────────────────────────────────────────
    await navegar(page, 'partidas', 500);
    // O rodapé "mostrando X de Y" vive DENTRO do tbody e usa colspan, então
    // contar <tr> cru dava sempre uma linha a mais que o real.
    await page.evaluate(() => {
      window.__dados = (sel) => [...document.querySelectorAll(sel + ' tr')]
        .filter((tr) => !tr.querySelector('td[colspan]'));
    });

    const p1 = await page.evaluate(() => ({
      linhas: window.__dados('#tbody-partidas').length,
      total: DB.partidas.length,
      temBotao: !!document.querySelector('#page-partidas button[onclick*="maisPartidas"]'),
    }));
    ok('partidas: a primeira página mostra só o passo', p1.linhas === passo, JSON.stringify(p1));
    ok('partidas: existe o botão de mostrar mais', p1.temBotao, JSON.stringify(p1));

    await page.evaluate(() => maisPartidas());
    await page.waitForTimeout(300);
    const p2 = await page.evaluate(() => window.__dados('#tbody-partidas').length);
    ok('partidas: mostrar mais acrescenta o passo', p2 === passo * 2, String(p2));

    // Clicar até o fim tem de chegar ao total exato — nem faltando, nem
    // repetindo linha.
    const pFim = await page.evaluate(() => {
      for (let i = 0; i < 20; i++) maisPartidas();
      const ids = window.__dados('#tbody-partidas')
        .map((tr) => tr.getAttribute('onclick') || tr.innerText.slice(0, 40));
      return { linhas: ids.length, unicas: new Set(ids).size, total: DB.partidas.length,
               botao: !!document.querySelector('#page-partidas button[onclick*="maisPartidas"]') };
    });
    ok('partidas: ao abrir tudo chega ao total, sem repetir',
       pFim.linhas === pFim.total && pFim.unicas === pFim.linhas, JSON.stringify(pFim));
    ok('partidas: o botão desaparece quando tudo está à vista', !pFim.botao, JSON.stringify(pFim));

    // ── Scouts ───────────────────────────────────────────────────────
    await navegar(page, 'scout', 500);
    const s1 = await page.evaluate(() => ({
      linhas: window.__dados('#tbody-scouts').length,
      temBotao: !!document.querySelector('#page-scout button[onclick*="maisScouts"]'),
    }));
    ok('scouts: a primeira página mostra só o passo', s1.linhas === passo, JSON.stringify(s1));
    ok('scouts: existe o botão de mostrar mais', s1.temBotao, JSON.stringify(s1));

    // ── Filtrar precisa VOLTAR para a primeira página ────────────────
    // Senão o usuário filtra, sobram 3 resultados, e ele continua vendo a
    // contagem antiga ou uma lista vazia.
    const filtrado = await page.evaluate(() => {
      navigate('partidas');
      for (let i = 0; i < 6; i++) maisPartidas();   // abre bem além do passo
      const el = document.getElementById('search-partidas');
      el.value = 'Corinthians';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      renderPartidas();
      const linhas = window.__dados('#tbody-partidas');
      return { linhas: linhas.length,
               todasCasam: linhas.every((tr) => /Corinthians/i.test(tr.innerText)),
               esperado: DB.partidas.filter((p) => /Corinthians/i.test(p.adversario || '')).length };
    });
    ok('filtrar mostra apenas o que casa com a busca',
       filtrado.linhas > 0 && filtrado.todasCasam, JSON.stringify(filtrado));
    ok('filtrar volta para a primeira página (não some com resultado)',
       filtrado.linhas === Math.min(passo, filtrado.esperado), JSON.stringify(filtrado));

    // ── Cache do DB: salvar precisa ser visto na hora ────────────────
    const cache = await page.evaluate(() => {
      const antes = DB.goleiras.length;
      const gks = DB.goleiras;
      gks.push({ id: 'novo-gk', nome: 'Recém Cadastrada', modalidade: 'futsal', naipe: 'feminino' });
      DB.saveGoleiras(gks);
      const depois = DB.goleiras.length;
      const achou = !!DB.goleiras.find((g) => g.id === 'novo-gk');

      // Escrita direta no localStorage, por fora do DB (é o que a
      // sincronização com a nuvem e a restauração de backup fazem). O cache
      // é chaveado pela string crua, então tem de perceber a troca.
      const lista = JSON.parse(localStorage.getItem('gkhub_goleiras'));
      lista.push({ id: 'de-fora', nome: 'Veio da Nuvem', modalidade: 'futsal' });
      localStorage.setItem('gkhub_goleiras', JSON.stringify(lista));
      const viuDeFora = !!DB.goleiras.find((g) => g.id === 'de-fora');

      // E mexer na lista devolvida não pode contaminar a próxima leitura.
      const copia = DB.goleiras; copia.length = 0;
      const intacto = DB.goleiras.length > 0;

      return { antes, depois, achou, viuDeFora, intacto };
    });
    ok('salvar aparece imediatamente na leitura seguinte',
       cache.depois === cache.antes + 1 && cache.achou, JSON.stringify(cache));
    ok('cache percebe escrita feita por fora (nuvem/backup)', cache.viuDeFora, JSON.stringify(cache));
    ok('mexer na lista devolvida não corrompe o cache', cache.intacto, JSON.stringify(cache));

    ok('sem erro de JavaScript com 240 partidas', erros.length === 0, erros.slice(0, 3).join(' | '));
  } finally {
    await browser.close();
  }
  return ok;
};
