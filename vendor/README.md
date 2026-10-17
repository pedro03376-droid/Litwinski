# vendor/ — bibliotecas servidas pelo próprio GK Hub

Estes arquivos **não** vêm de CDN de terceiros. Um `<script>` de terceiro roda
com acesso total aos dados das atletas e à sessão do técnico: se a CDN for
comprometida (ou a conta de quem publica lá), o GK Hub é comprometido junto,
sem que ninguém perceba. Servindo daqui, só quem publica o GK Hub pode mudar
este código.

Todas as bibliotecas são **MIT**.

| Arquivo | Pacote npm | Versão |
|---|---|---|
| `chart.umd.js` | `chart.js` | 4.4.0 |
| `jspdf.umd.min.js` | `jspdf` | 2.5.1 |
| `jspdf.plugin.autotable.min.js` | `jspdf-autotable` | 3.8.2 |
| `html2canvas.min.js` | `html2canvas` | 1.4.1 |
| `qrcode.min.js` | `davidshimjs-qrcodejs` | 1.0.0 |

O `qrcode.min.js` não traz cabeçalho de licença no arquivo, então a licença
está em `qrcode.LICENSE.txt`, ao lado. Os outros quatro já trazem o cabeçalho
embutido.

## Por que o Firebase continua no gstatic

O SDK do Firebase (`firebase-*-compat.js`) segue vindo de `www.gstatic.com`,
de propósito: é o mesmo Google que já hospeda o banco e a autenticação. Trazer
para cá não removeria ninguém da lista de quem precisamos confiar, e o login
por popup espera ser servido pelo domínio do Google.

## Para atualizar uma biblioteca

```sh
npm install chart.js@<nova-versao>          # num diretório temporário
cp node_modules/chart.js/dist/chart.umd.js  frontend/vendor/
```

Depois **rode os testes de PDF e o smoke** antes de publicar: estas bibliotecas
desenham os gráficos e geram os relatórios, e uma incompatibilidade aparece no
relatório do técnico, não no console.

Atenção ao Chart.js: o jsDelivr servia `chart.umd.min.js`, um arquivo que
**não existe no pacote npm** — a CDN minificava na hora. Aqui usamos o
`chart.umd.js` (não minificado) justamente por ser o arquivo oficial e
verificável do pacote.
