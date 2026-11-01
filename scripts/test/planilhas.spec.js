/*
 * Planilhas (CSV) — abre no Excel brasileiro e não executa fórmula.
 *
 * Três coisas quebram um CSV para o treinador: acento virando símbolo (falta
 * de BOM), número decimal com ponto (Excel pt-BR lê como texto) e separador
 * errado (tudo numa coluna). As três são verificadas aqui, além da injeção
 * de fórmula, que é a parte de segurança.
 */
const playwright = require('playwright');
const { abrirNavegador, abrirApp, criarChecks, semente } = require('./harness');

module.exports = async function () {
  const ok = criarChecks();
  const browser = await abrirNavegador(playwright);
  try {
    const { page, erros } = await abrirApp(browser, { semear: semente({ goleiras: 3, partidas: 8 }) });

    // Intercepta o download: _csvBaixar monta um Blob e clica num link.
    // Trocando a função por uma espiã, o conteúdo real fica inspecionável.
    await page.evaluate(() => {
      window.__csv = {};
      window.__origBaixar = _csvBaixar;
      // _csvBaixar recebe as linhas como valores crus e é ela quem aplica
      // _csvValor; a espiã faz a mesma formatação, para o teste conferir o
      // texto que de fato iria para o arquivo.
      window._csvBaixar = function (nome, linhas) {
        window.__csv[nome] = linhas.map((l) => l.map(_csvValor).join(';'));
      };
      // _csvBaixar é chamada por nome dentro do escopo do script, então a
      // substituição precisa alcançar essa ligação, não só o window.
      try { eval('_csvBaixar = window._csvBaixar'); } catch (e) { window.__evalFalhou = String(e.message); }
    });

    const substituiu = await page.evaluate(() => !window.__evalFalhou);
    ok('é possível espiar o download do CSV', substituiu, await page.evaluate(() => window.__evalFalhou || ''));

    const r = await page.evaluate(() => {
      // Nomes perigosos antes de exportar: o ataque entra pelo cadastro.
      const gks = DB.goleiras;
      gks[0].nome = '=1+1';
      gks[0].equipe = '@SUM(A1:A9)';
      if (gks[1]) gks[1].nome = '-2+3';
      if (gks[2]) gks[2].nome = 'Mônica "Mô" Alves; e vírgula';
      DB.saveGoleiras(gks);
      const ps = DB.partidas; ps[0].adversario = '+EXPLOIT'; DB.savePartidas(ps);

      exportCsvGoleiras(); exportCsvPartidas(); exportCsvScouts();
      return window.__csv;
    });

    const nomes = Object.keys(r);
    ok('três planilhas foram geradas', nomes.length === 3, nomes.join(', '));
    ok('nomes de arquivo trazem a data', nomes.every((n) => /_\d{4}-\d{2}-\d{2}\.csv$/.test(n)), nomes.join(', '));

    for (const nome of nomes) {
      const linhas = r[nome];
      const curto = nome.replace(/^gkhub_|_\d{4}.*$/g, '');
      ok(curto + ': tem cabeçalho e ao menos uma linha', linhas.length >= 2, 'linhas=' + linhas.length);

      // Separador: ';' é o que o Excel pt-BR espera.
      ok(curto + ': separador é ponto e vírgula',
         linhas.every((l) => l.indexOf(';') > 0), 'linha sem ;');

      // Todo campo entre aspas — assim ';' dentro do texto não parte a coluna.
      // Contar por split(';') daria falso alarme justamente quando a proteção
      // está funcionando (nome com ponto e vírgula dentro das aspas), então
      // conta campos entre aspas, como o Excel faz.
      const nCampos = (l) => (l.match(/"(?:[^"]|"")*"/g) || []).length;
      const colunasCab = nCampos(linhas[0]);
      const desalinhadas = linhas.filter((l) => nCampos(l) !== colunasCab).length;
      ok(curto + ': todas as linhas têm o mesmo número de colunas',
         desalinhadas === 0, desalinhadas + ' desalinhada(s) de ' + linhas.length);

      // Injeção de fórmula: nenhum campo pode ABRIR com caractere ativo.
      const campos = linhas.join('\n').match(/"(?:[^"]|"")*"/g) || [];
      const perigosos = campos.filter((c) => /^"[=+\-@\t\r]/.test(c));
      ok(curto + ': nenhum campo começa com = + - @',
         perigosos.length === 0, perigosos.slice(0, 3).join(' '));

      // Decimal com vírgula: número com ponto o Excel pt-BR trata como texto.
      const comPonto = campos.filter((c) => /^"\d+\.\d+"$/.test(c));
      ok(curto + ': decimais usam vírgula, não ponto',
         comPonto.length === 0, comPonto.slice(0, 3).join(' '));
    }

    // BOM: sem ele o Excel mostra "MÃ´nica" em vez de "Mônica".
    const bom = await page.evaluate(() => {
      const linhas = window.__csv[Object.keys(window.__csv)[0]];
      // _csvBaixar original prefixa '﻿'; confere na fonte da função.
      return String(window.__origBaixar).includes('\\uFEFF') || String(window.__origBaixar).includes('﻿');
    });
    ok('arquivo leva BOM (acento correto no Excel)', bom);

    ok('sem erro de JavaScript ao exportar', erros.length === 0, erros.join(' | '));
  } finally {
    await browser.close();
  }
  return ok;
};
