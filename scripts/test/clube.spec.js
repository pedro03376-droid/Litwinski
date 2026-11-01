/*
 * Clube — isolamento e controle de acesso.
 *
 * Esta é a regra que não pode ceder: o dado de um clube nunca encosta no de
 * outro. Na nuvem isso depende de uma coisa só — o caminho onde cada clube
 * grava, derivado do código do clube. Se dois códigos diferentes gerassem o
 * mesmo caminho, dois clubes dividiriam o elenco sem ninguém perceber.
 *
 * As chamadas de rede são trocadas por espiãs, então o teste não depende do
 * Firebase e registra EXATAMENTE em que caminho cada escrita cairia.
 */
const playwright = require('playwright');
const { abrirNavegador, abrirApp, criarChecks, semente } = require('./harness');

// Caracteres que o Firebase proíbe em chave de caminho. Se um deles vazar
// para o caminho, a escrita falha — ou, pior, cai em outro nó.
const PROIBIDOS = ['.', '#', '$', '/', '[', ']'];

module.exports = async function () {
  const ok = criarChecks();
  const browser = await abrirNavegador(playwright);
  try {
    const { page, erros } = await abrirApp(browser, { semear: semente({ goleiras: 3, partidas: 5 }) });

    // ── O caminho de cada clube ──────────────────────────────────────
    const segs = await page.evaluate((proibidos) => {
      const chaves = ['clube-alfa', 'clube-beta', 'CLUBE-ALFA', 'a.b#c$d/e[f]g',
                      'Ação & Cia', 'x'.repeat(200), 'clube alfa'];
      const r = chaves.map((k) => {
        localStorage.setItem('gkhub_club_key', k);
        return { chave: k, seg: _cloudClubSeg() };
      });
      return { r, proibidos };
    }, PROIBIDOS);

    const vistos = segs.r.map((x) => x.seg);
    ok('códigos diferentes dão caminhos diferentes',
       new Set(vistos).size === vistos.length,
       JSON.stringify(segs.r.map((x) => x.chave + ' → ' + x.seg)));

    const comProibido = segs.r.filter((x) => PROIBIDOS.some((c) => x.seg.includes(c)));
    ok('nenhum caminho contém . # $ / [ ]',
       comProibido.length === 0, JSON.stringify(comProibido));

    ok('nenhum caminho sai vazio',
       segs.r.every((x) => x.seg && x.seg.length > 0), JSON.stringify(vistos));

    // ── Onde as escritas realmente caem ──────────────────────────────
    const escritas = await page.evaluate(async () => {
      const log = [];
      // Espiãs no lugar da rede: nada sai do navegador, e o caminho fica
      // registrado tal como seria enviado.
      // eslint-disable-next-line no-eval
      eval('rtdbPut = async function (p, d) { log.push({ m: "PUT", p: p }); return d; };' +
           'rtdbGet = async function (p) { log.push({ m: "GET", p: p }); return null; };' +
           'rtdbDelete = async function (p) { log.push({ m: "DEL", p: p }); return null; };' +
           'rtdbUrl = "https://exemplo-teste.firebaseio.com";');
      window.__log = log;

      const paraClube = async (chave) => {
        localStorage.setItem('gkhub_club_key', chave);
        log.length = 0;
        await rtdbPut('/clubs/' + _cloudClubSeg() + '/goleiras', DB.goleiras);
        return log.map((x) => x.p);
      };
      return { alfa: await paraClube('clube-alfa'), beta: await paraClube('clube-beta') };
    });

    ok('a escrita do clube alfa vai para o nó do alfa',
       escritas.alfa.every((p) => p.includes('clube-alfa')), JSON.stringify(escritas.alfa));
    ok('a escrita do clube beta vai para o nó do beta',
       escritas.beta.every((p) => p.includes('clube-beta')), JSON.stringify(escritas.beta));
    ok('nenhum caminho de um clube aparece no do outro',
       !escritas.alfa.some((p) => escritas.beta.includes(p)),
       JSON.stringify(escritas));
    ok('todas as escritas ficam sob /clubs/<codigo>/',
       [...escritas.alfa, ...escritas.beta].every((p) => /^\/clubs\/[^/]+\//.test(p)),
       JSON.stringify(escritas));

    // ── Código de clube novo: tem de ser imprevisível ────────────────
    // Código adivinhável deixa qualquer um entrar no clube alheio. O valor
    // vem de crypto.getRandomValues; aqui conferimos tamanho e variedade.
    const codigos = await page.evaluate(() => {
      const l = []; for (let i = 0; i < 200; i++) l.push(_novoCodigoClube()); return l;
    });
    ok('todo código novo é único em 200 sorteios',
       new Set(codigos).size === 200, String(new Set(codigos).size));
    ok('o código é longo o bastante para não ser adivinhado',
       codigos.every((c) => c.length >= 20), 'menor=' + Math.min(...codigos.map((c) => c.length)));
    ok('o código não traz a hora nem nada sequencial',
       // dois sorteios seguidos não podem compartilhar um prefixo longo
       !codigos.slice(1).some((c, i) => c.slice(0, 8) === codigos[i].slice(0, 8)),
       codigos.slice(0, 3).join(' '));

    // ── Estado de acesso ─────────────────────────────────────────────
    // Sem dono definido, quem tem o código entra. Com dono, quem chega fica
    // pendente até ser liberado. Esse é o comportamento que o dono do clube
    // espera ao clicar em "Exigir aprovação".
    const acesso = await page.evaluate(async () => {
      let donoRemoto = null;
      // eslint-disable-next-line no-eval
      eval('rtdbGet = async function (p) { return /clubOwners/.test(p) ? window.__dono : ' +
           '(/clubMembers/.test(p) ? window.__membro : null); };' +
           'rtdbPut = async function () { return true; };' +
           'rtdbUrl = "https://exemplo-teste.firebaseio.com";' +
           '_me = function () { return { uid: "uid-visitante" }; };');

      const cenario = async (dono, membro) => {
        window.__dono = dono; window.__membro = membro;
        // _membershipEnsuredFor guarda o último clube resolvido; sem limpar,
        // a segunda chamada sai pela porta rápida.
        // eslint-disable-next-line no-eval
        eval('_membershipEnsuredFor = null;');
        localStorage.setItem('gkhub_club_key', 'c' + Math.random().toString(36).slice(2));
        await _ensureClubMembership();
        return Object.assign({}, _clubAccess);
      };

      return {
        semDono: await cenario(null, null),
        donoEhOutro: await cenario('uid-do-dono', null),
        donoEhOutroLiberado: await cenario('uid-do-dono', true),
        souODono: await cenario('uid-visitante', null),
      };
    });

    ok('clube sem dono: quem tem o código entra',
       acesso.semDono.approved === true && acesso.semDono.pending === false,
       JSON.stringify(acesso.semDono));
    ok('clube com dono: visitante fica PENDENTE, não entra',
       acesso.donoEhOutro.approved === false && acesso.donoEhOutro.pending === true,
       JSON.stringify(acesso.donoEhOutro));
    ok('visitante liberado pelo dono passa a entrar',
       acesso.donoEhOutroLiberado.approved === true && acesso.donoEhOutroLiberado.pending === false,
       JSON.stringify(acesso.donoEhOutroLiberado));
    ok('o próprio dono entra e é reconhecido como dono',
       acesso.souODono.isOwner === true && acesso.souODono.approved === true,
       JSON.stringify(acesso.souODono));
    ok('visitante pendente nunca é marcado como dono',
       acesso.donoEhOutro.isOwner === false, JSON.stringify(acesso.donoEhOutro));

    ok('sem erro de JavaScript nos cenários de clube',
       erros.length === 0, erros.slice(0, 3).join(' | '));
  } finally {
    await browser.close();
  }
  return ok;
};
