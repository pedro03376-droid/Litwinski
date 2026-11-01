#!/usr/bin/env node
/*
 * Roda a suíte. Sem argumentos roda tudo; com argumentos roda só os
 * arquivos cujo nome contém o texto dado:
 *
 *   node scripts/test/run-all.js
 *   node scripts/test/run-all.js seguranca isolamento
 *
 * Sai com código 1 se qualquer verificação falhar, para o CI reprovar.
 */
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const filtros = process.argv.slice(2);

const arquivos = fs.readdirSync(DIR)
  .filter((f) => f.endsWith('.spec.js'))
  .filter((f) => !filtros.length || filtros.some((t) => f.includes(t)))
  .sort();

if (!arquivos.length) {
  console.error('nenhum teste encontrado' + (filtros.length ? ' para: ' + filtros.join(', ') : ''));
  process.exit(1);
}

(async () => {
  let totalFalhas = 0, totalChecks = 0;
  const resumo = [];
  const t0 = Date.now();

  for (const arquivo of arquivos) {
    const nome = arquivo.replace(/\.spec\.js$/, '');
    console.log('\n── ' + nome + ' ' + '─'.repeat(Math.max(0, 60 - nome.length)));
    let falhas, checks;
    try {
      const ok = await require(path.join(DIR, arquivo))();
      checks = ok.itens.length;
      falhas = ok.relatar();
    } catch (e) {
      console.log('  ✗ o próprio teste quebrou\n        → ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e));
      checks = 0; falhas = 1;
    }
    totalChecks += checks; totalFalhas += falhas;
    resumo.push({ nome, checks, falhas });
  }

  const seg = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('\n' + '═'.repeat(64));
  for (const r of resumo) {
    console.log((r.falhas ? '✗ ' : '✓ ') + r.nome.padEnd(20) +
      (r.checks ? Math.max(0, r.checks - r.falhas) + '/' + r.checks : 'quebrou antes de verificar'));
  }
  console.log('═'.repeat(64));
  console.log(totalFalhas
    ? totalFalhas + ' FALHA(S) de ' + totalChecks + ' verificações (' + seg + 's)'
    : totalChecks + ' verificações passaram (' + seg + 's)');
  process.exit(totalFalhas ? 1 : 0);
})();
