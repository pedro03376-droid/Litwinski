/*
 * Renderização — toda página abre, com dados e sem dados.
 *
 * O e2e-smoke.js já cobre o caminho felizão. Aqui o alvo é o outro: a tela
 * vazia. Boa parte dos erros de JavaScript do app aparecia em clube novo,
 * sem elenco e sem jogo, porque o código assumia que a lista tinha ao menos
 * um item.
 */
const playwright = require('playwright');
const { abrirNavegador, abrirApp, navegar, criarChecks, semente, PAGINAS } = require('./harness');

module.exports = async function () {
  const ok = criarChecks();
  const browser = await abrirNavegador(playwright);
  try {
    // ── Com dados ────────────────────────────────────────────────────
    const cheio = await abrirApp(browser, { semear: semente({ goleiras: 4, partidas: 20 }) });

    // Antes de qualquer outra coisa: nada tapando a tela. Um aviso de aceite
    // ou de login na frente deixa todo teste seguinte passar sem ter olhado
    // nada — foi exatamente o que aconteceu com o e2e-smoke, que rodou meses
    // com o aviso de termos aberto porque a versão no seed envelheceu.
    const porta = await cheio.page.evaluate(() => {
      const visivel = (id) => {
        const el = document.getElementById(id);
        if (!el) return false;
        if (el.classList.contains('hidden')) return false;
        const cs = getComputedStyle(el);
        return cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity || '1') > 0.1;
      };
      const tapando = [...document.querySelectorAll('.modal.active, .modal-overlay.active, .overlay:not(.hidden)')]
        .filter((el) => getComputedStyle(el).display !== 'none')
        .map((el) => el.id || el.className);
      return { auth: visivel('auth-overlay'), tapando,
               scroll: getComputedStyle(document.body).overflow };
    });
    ok('o app abre sem aviso de login na frente', !porta.auth, JSON.stringify(porta));
    ok('nenhum modal fica aberto no boot', porta.tapando.length === 0, JSON.stringify(porta.tapando));
    ok('a página pode rolar (body não travado)',
       porta.scroll !== 'hidden', porta.scroll);

    for (const p of PAGINAS) {
      await navegar(cheio.page, p);
      const r = await cheio.page.evaluate((pg) => {
        const el = document.getElementById('page-' + pg);
        if (!el) return { faltando: true };
        const cs = getComputedStyle(el);
        return { visivel: cs.display !== 'none', conteudo: el.innerHTML.trim().length };
      }, p);
      ok('com dados: ' + p + ' aparece e tem conteúdo',
         !r.faltando && r.visivel && r.conteudo > 50, JSON.stringify(r));
    }
    ok('com dados: nenhum erro de JavaScript em 20 páginas',
       cheio.erros.length === 0, cheio.erros.slice(0, 4).join(' | '));
    await cheio.page.close();

    // ── Clube recém-criado, sem nada cadastrado ──────────────────────
    const vazio = await abrirApp(browser, { semear: semente({ goleiras: 0, partidas: 0 }) });
    for (const p of PAGINAS) {
      await navegar(vazio.page, p);
      const r = await vazio.page.evaluate((pg) => {
        const el = document.getElementById('page-' + pg);
        if (!el) return { faltando: true };
        // Tabela com corpo vazio é tela quebrada, não tela vazia: o usuário
        // vê um buraco sem explicação. Vazio de verdade tem .empty-state.
        //
        // Só conta tabela que o usuário realmente vê. Várias páginas trocam
        // a tabela por um cartão de "nada aqui ainda" e deixam a tabela
        // escondida no HTML — isso está correto, e contá-la inventava bug
        // (foi o que aconteceu com a página de perfil).
        const corposVazios = [...el.querySelectorAll('table tbody')]
          .filter((tb) => tb.children.length === 0 && tb.offsetParent !== null).length;
        return { corposVazios, texto: (el.innerText || '').trim().length };
      }, p);
      ok('sem dados: ' + p + ' não deixa tabela oca',
         !r.faltando && r.corposVazios === 0, JSON.stringify(r));
    }
    ok('sem dados: nenhum erro de JavaScript em 20 páginas',
       vazio.erros.length === 0, vazio.erros.slice(0, 4).join(' | '));
  } finally {
    await browser.close();
  }
  return ok;
};
