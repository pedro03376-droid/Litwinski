/*
 * PIX — o código copiado precisa ser aceito pelo banco de quem paga.
 *
 * Aqui não há como confirmar que o dinheiro chega (isso só o app do banco
 * diz). O que dá para garantir é a parte onde um erro silencioso custaria
 * uma assinatura: o payload EMV bem formado, o CRC correto e os dados do
 * recebedor batendo com a configuração — porque um CRC errado faz o banco
 * recusar o código sem dizer por quê.
 */
const playwright = require('playwright');
const { abrirNavegador, abrirApp, criarChecks } = require('./harness');

// CRC-16/CCITT-FALSE, reimplementado aqui de propósito: conferir o resultado
// do app com a MESMA função do app não provaria nada.
function crc16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// Percorre o payload campo a campo (id de 2 dígitos + tamanho de 2 + valor).
// Se a estrutura estiver torta, a varredura não fecha no fim da string.
function lerEmv(s) {
  const campos = {};
  let i = 0;
  while (i < s.length) {
    const id = s.slice(i, i + 2);
    const tam = parseInt(s.slice(i + 2, i + 4), 10);
    if (!/^\d{2}$/.test(id) || !isFinite(tam)) return { erro: 'campo inválido em ' + i, campos };
    campos[id] = s.slice(i + 4, i + 4 + tam);
    i += 4 + tam;
  }
  return { erro: i === s.length ? null : 'tamanhos não fecham', campos };
}

module.exports = async function () {
  const ok = criarChecks();
  const browser = await abrirNavegador(playwright);
  try {
    const { page, erros } = await abrirApp(browser);

    const d = await page.evaluate(() => ({
      payload: _pixBRCode(),
      cfg: { chave: BILLING.pixKey, titular: BILLING.pixTitular, cidade: BILLING.pixCidade,
             mensal: BILLING.mensal, anual: BILLING.anual },
      // _pixTexto tira acento e sobe para maiúscula: o padrão não aceita
      // acento no nome do recebedor.
      texto: [_pixTexto('Pedro Henrique L. de S.', 25), _pixTexto('São José', 15), _pixTexto('Lages', 15)],
    }));

    ok('o payload foi gerado', typeof d.payload === 'string' && d.payload.length > 60,
       String(d.payload).slice(0, 40));

    const { erro, campos } = lerEmv(d.payload);
    ok('estrutura EMV fecha campo a campo', !erro, erro || '');

    ok('versão do payload (00) é 01', campos['00'] === '01', campos['00']);
    ok('declara BR.GOV.BCB.PIX no campo 26',
       (campos['26'] || '').includes('BR.GOV.BCB.PIX'), campos['26']);
    ok('a chave no payload é a chave configurada',
       (campos['26'] || '').includes(d.cfg.chave), campos['26']);
    ok('moeda (53) é 986 — real', campos['53'] === '986', campos['53']);
    ok('país (58) é BR', campos['58'] === 'BR', campos['58']);
    ok('recebedor (59) bate com o titular configurado',
       campos['59'] === d.cfg.titular.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase(),
       campos['59'] + ' vs ' + d.cfg.titular);
    ok('cidade (60) bate com a configurada',
       campos['60'] === d.cfg.cidade.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase(),
       campos['60'] + ' vs ' + d.cfg.cidade);
    ok('recebedor e cidade sem acento e em maiúscula',
       !/[a-zà-ú]/.test((campos['59'] || '') + (campos['60'] || '')),
       campos['59'] + ' / ' + campos['60']);
    ok('nome do recebedor cabe no limite de 25 caracteres',
       (campos['59'] || '').length <= 25, String((campos['59'] || '').length));

    // CRC: os 4 últimos caracteres, calculados sobre tudo até "6304" inclusive.
    const corpo = d.payload.slice(0, -4);
    ok('o payload termina com o marcador 6304', corpo.endsWith('6304'), corpo.slice(-6));
    const esperado = crc16(corpo);
    ok('CRC-16 confere com cálculo independente',
       d.payload.slice(-4) === esperado, 'app=' + d.payload.slice(-4) + ' esperado=' + esperado);

    ok('_pixTexto remove acento e sobe para maiúscula',
       d.texto[0] === 'PEDRO HENRIQUE L. DE S.' && d.texto[1] === 'SAO JOSE', JSON.stringify(d.texto));

    ok('preços configurados são números positivos',
       d.cfg.mensal > 0 && d.cfg.anual > 0, JSON.stringify(d.cfg));
    ok('o anual é mais barato que 12 meses avulsos',
       d.cfg.anual < d.cfg.mensal * 12, d.cfg.anual + ' vs ' + d.cfg.mensal * 12);

    ok('sem erro de JavaScript ao gerar o PIX', erros.length === 0, erros.join(' | '));
  } finally {
    await browser.close();
  }
  return ok;
};
