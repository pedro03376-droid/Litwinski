/*
 * Acessibilidade — o que o axe mede e o que ele não mede.
 *
 * Duas lições estão embutidas aqui.
 *
 * A primeira: medir cor no meio da animação de entrada inventa problema. Na
 * auditoria, 72 de 143 "violações de contraste" eram a animação, não a cor.
 * Por isso o teste roda com reducedMotion e espera o layout assentar.
 *
 * A segunda: o axe não acusa ausência de região viva. O app tinha 257
 * chamadas de aviso e nenhum aria-live — todo retorno era só visual, e para
 * quem usa leitor de tela o app salvava em silêncio. Isso só se pega com
 * teste explícito, que é a segunda metade deste arquivo.
 */
const path = require('path');
const playwright = require('playwright');
const { abrirNavegador, abrirApp, navegar, assentar, criarChecks, semente, PAGINAS } = require('./harness');

const AXE = require.resolve('axe-core/axe.min.js');

// Páginas de maior uso diário; rodar o axe nas 20 levaria minutos no CI sem
// acrescentar muito, porque todas compartilham os mesmos componentes.
const FOCO = ['dashboard', 'goleiras', 'partidas', 'scout', 'executivo', 'clube'];

module.exports = async function () {
  const ok = criarChecks();
  const browser = await abrirNavegador(playwright);
  try {
    // ── axe-core, com o layout parado ────────────────────────────────
    for (const tema of ['dark', 'light']) {
      const { page } = await abrirApp(browser, {
        semear: semente({ goleiras: 4, partidas: 12, tema }),
        reducedMotion: 'reduce',
      });
      await page.addScriptTag({ path: AXE });

      for (const pg of FOCO) {
        await navegar(page, pg, 300);
        await assentar(page);
        const res = await page.evaluate(async (sel) => {
          const r = await window.axe.run(sel, {
            runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
            resultTypes: ['violations'],
          });
          return r.violations.map((v) => ({
            id: v.id, n: v.nodes.length,
            exemplo: (v.nodes[0] && v.nodes[0].target && v.nodes[0].target[0]) || '',
          }));
        }, '#page-' + pg);
        const total = res.reduce((a, v) => a + v.n, 0);
        ok('axe ' + tema + ': ' + pg + ' sem violação WCAG AA',
           res.length === 0, total + ' em ' + res.map((v) => v.id + '×' + v.n + ' (' + v.exemplo + ')').join(', '));
      }
      await page.close();
    }

    // ── Iniciais do avatar: TODAS as cores, não só a sorteada ────────
    // O cartão de destaque tinge as iniciais conforme o que está sendo
    // destacado (evolução positiva, negativa, sem dado). Com dados
    // aleatórios, o axe via uma cor por execução e a falha aparecia uma vez
    // em três. Aqui as variantes são montadas à mão, todas de uma vez.
    for (const tema of ['dark', 'light']) {
      const { page } = await abrirApp(browser, { semear: semente({ tema }), reducedMotion: 'reduce' });
      await page.addScriptTag({ path: AXE });
      const res = await page.evaluate(async () => {
        const cores = ['var(--muted)', 'var(--success)', 'var(--error)',
                       'var(--warning)', 'var(--primary-text)', 'var(--text)'];
        const caixa = document.createElement('div');
        caixa.id = 'teste-avatares';
        // Monta pelo MESMO caminho do app (_gkAvatarInner). Escrever o HTML
        // à mão aqui já deu errado: o app passou a cor por variável CSS, o
        // teste continuou com `color:` direto e acusou falha que não existia
        // mais — fixture desatualizada vira alarme falso.
        caixa.innerHTML = cores.map((c, i) => '<div class="destaque-avatar" data-cor="' + i +
          '" style="border-color:' + c + '">' + _gkAvatarInner({ nome: 'Mônica Alves' }, c) +
          '</div>').join('');
        (document.querySelector('.content') || document.body).appendChild(caixa);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const r = await window.axe.run('#teste-avatares', {
          runOnly: ['color-contrast'], resultTypes: ['violations'],
        });
        return r.violations.flatMap((v) => v.nodes.map((n) => {
          const i = +(n.element ? n.element.closest('[data-cor]').dataset.cor : -1);
          return { cor: cores[i] || n.target[0], msg: (n.any[0] && n.any[0].message || '').slice(0, 90) };
        }));
      });
      ok('avatar ' + tema + ': iniciais legíveis em todas as cores do destaque',
         res.length === 0, JSON.stringify(res));
      await page.close();
    }

    // ── Região viva: o que o axe não vê ──────────────────────────────
    const { page, erros } = await abrirApp(browser, { reducedMotion: 'reduce' });

    const cont = await page.evaluate(() => {
      const el = document.getElementById('toasts');
      return el && { live: el.getAttribute('aria-live'), role: el.getAttribute('role'),
                     atomic: el.getAttribute('aria-atomic'), vazio: el.children.length === 0 };
    });
    ok('o container de avisos existe', !!cont, 'não encontrei #toasts');
    ok('…com aria-live="polite"', cont && cont.live === 'polite', cont && cont.live);
    ok('…com role="status"', cont && cont.role === 'status', cont && cont.role);
    // Precisa existir VAZIO no HTML: região viva criada junto com a mensagem
    // não é anunciada pelo leitor de tela.
    ok('…e já presente e vazio antes do primeiro aviso',
       cont && cont.vazio, JSON.stringify(cont));

    const avisos = await page.evaluate(() => {
      toast('Scout salvo!', 'success');
      toast('Falha na sincronização.', 'error');
      return [...document.querySelectorAll('#toasts .toast')]
        .map((e) => ({ texto: e.textContent, role: e.getAttribute('role') }));
    });
    ok('aviso comum entra na região polite',
       avisos.some((a) => /Scout salvo/.test(a.texto) && !a.role), JSON.stringify(avisos));
    // Erro usa role="alert": interrompe o leitor de tela, porque o usuário
    // precisa saber na hora que a ação NÃO deu certo.
    ok('aviso de erro recebe role="alert"',
       avisos.some((a) => /Falha/.test(a.texto) && a.role === 'alert'), JSON.stringify(avisos));

    const errosForm = await page.evaluate(() => ['auth-err', 'register-err', 'add-member-err']
      .map((id) => ({ id, role: document.getElementById(id) && document.getElementById(id).getAttribute('role') })));
    ok('erros de formulário são anunciados',
       errosForm.every((e) => e.role === 'alert'), JSON.stringify(errosForm));

    // ── Teclado: rótulo e alvo ───────────────────────────────────────
    const rotulos = await page.evaluate(() => {
      const sem = [];
      document.querySelectorAll('button, a[href], [role="button"]').forEach((el) => {
        if (el.offsetParent === null) return;              // escondido: ignora
        const texto = (el.innerText || '').trim();
        const rotulo = el.getAttribute('aria-label') || el.getAttribute('title');
        if (!texto && !rotulo) sem.push(el.id || el.className || el.outerHTML.slice(0, 60));
      });
      return sem;
    });
    ok('nenhum botão visível fica sem texto nem rótulo',
       rotulos.length === 0, rotulos.slice(0, 4).join(' | '));

    // Remover o anel de foco deixa quem navega por teclado sem saber onde
    // está. Varrer document.styleSheets não serve: sob file:// o navegador
    // trata a folha externa como outra origem e cssRules lança — o teste
    // dizia "sem anel de foco" quando a regra existia. Então mede-se o
    // efeito: foca de verdade, pelo teclado, e lê o estilo resultante.
    await page.evaluate(() => navigate('goleiras'));
    await page.waitForTimeout(250);
    await page.keyboard.press('Tab');
    const foco = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return { nada: true };
      const cs = getComputedStyle(el);
      const largura = parseFloat(cs.outlineWidth) || 0;
      return {
        alvo: el.tagName + (el.id ? '#' + el.id : ''),
        anel: (largura > 0 && cs.outlineStyle !== 'none') || (cs.boxShadow && cs.boxShadow !== 'none'),
        outline: cs.outlineStyle + ' ' + cs.outlineWidth, sombra: cs.boxShadow,
      };
    });
    ok('Tab leva o foco a um elemento interativo', !foco.nada, JSON.stringify(foco));
    ok('o elemento focado pelo teclado mostra anel visível', foco.anel, JSON.stringify(foco));

    // Alvo de toque: 44×44 é o mínimo para dedo em tela de celular.
    await page.setViewportSize({ width: 390, height: 844 });
    // Medir logo depois de redimensionar pega o layout em movimento e acusa
    // botão "pequeno" que, parado, tem o tamanho certo. Esperar é parte do
    // teste, não enfeite.
    await assentar(page, 600);
    const pequenos = await page.evaluate(() => {
      const r = [];
      document.querySelectorAll('button, a[href], input[type="checkbox"], input[type="radio"]').forEach((el) => {
        if (el.offsetParent === null) return;
        const b = el.getBoundingClientRect();
        if (b.width > 0 && (b.width < 44 || b.height < 44)) {
          r.push(Math.round(b.width) + '×' + Math.round(b.height) + ' ' + (el.innerText || el.id || '').slice(0, 20));
        }
      });
      return r;
    });
    ok('no celular, todo alvo de toque tem 44×44 ou mais',
       pequenos.length === 0, pequenos.length + ': ' + pequenos.slice(0, 5).join(' | '));

    ok('sem erro de JavaScript durante a auditoria',
       erros.length === 0, erros.slice(0, 3).join(' | '));
  } finally {
    await browser.close();
  }
  return ok;
};
