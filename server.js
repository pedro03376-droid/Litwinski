/* ============================================================================
   ⚡ ANTENA DO JARVIS
   ----------------------------------------------------------------------------
   Node puro. Zero dependências. Zero npm install.
   Só os módulos nativos: http, https, tls.

   Para que serve:
     O navegador bloqueia uma página local de buscar agenda, e-mails e notícias
     na internet (política de CORS). Esta antena faz essa busca por fora e
     entrega os dados pro jarvis.html, que continua abrindo com dois cliques.

   Como rodar:
     node server.js
   (deixe este terminal aberto enquanto usar o Jarvis)

   Segurança:
     · Escuta SOMENTE em 127.0.0.1 — ninguém de fora da sua máquina alcança.
     · Proxy só aceita domínios da allowlist; qualquer outro → 403.
     · IMAP só aceita hosts da allowlist; qualquer outro → 403.
     · Senhas e links secretos NUNCA são escritos no terminal.
============================================================================ */

"use strict";

const http  = require("http");
const https = require("https");
const tls   = require("tls");

const PORT = 4242;
const HOST = "127.0.0.1";

/* Domínios liberados no /proxy. Qualquer outro devolve 403. */
const PROXY_ALLOWLIST = [
  "calendar.google.com",
  "news.google.com"
];

/* Hosts IMAP liberados no /emails. Adicione aqui se usar outro provedor. */
const IMAP_ALLOWLIST = [
  "imap.gmail.com",
  "outlook.office365.com",
  "imap-mail.outlook.com",
  "imap.mail.yahoo.com",
  "imap.zoho.com"
];

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/* ============================================================================
   UTILIDADES
============================================================================ */

function corsHeaders(extra) {
  const base = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "86400"
  };
  return Object.assign(base, extra || {});
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, corsHeaders({
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body)
  }));
  res.end(body);
}

function sendText(res, status, text, contentType) {
  const body = Buffer.from(text, "utf8");
  res.writeHead(status, corsHeaders({
    "content-type": (contentType || "text/plain") + "; charset=utf-8",
    "content-length": body.length
  }));
  res.end(body);
}

/* Mascara qualquer coisa que pareça credencial antes de ir pro terminal. */
function mask(str) {
  if (!str) return "";
  const s = String(str);
  if (s.length <= 6) return "***";
  return s.slice(0, 3) + "***" + s.slice(-2);
}

function maskUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    /* O caminho do .ics contém o token secreto da agenda — some com ele. */
    return u.protocol + "//" + u.host + "/…";
  } catch (e) {
    return "…";
  }
}

function log(msg) {
  const t = new Date().toLocaleTimeString("pt-BR");
  console.log("  [" + t + "] " + msg);
}

/* ============================================================================
   ROTA: GET /proxy?url=...
   Busca a URL na internet e devolve com CORS liberado.
============================================================================ */

function fetchUpstream(urlStr, depth) {
  depth = depth || 0;
  return new Promise((resolve, reject) => {
    if (depth > 3) return reject(new Error("Redirecionamentos demais."));

    let u;
    try {
      u = new URL(urlStr);
    } catch (e) {
      return reject(new Error("URL inválida."));
    }

    if (PROXY_ALLOWLIST.indexOf(u.hostname) === -1) {
      const err = new Error("Domínio fora da allowlist: " + u.hostname);
      err.forbidden = true;
      return reject(err);
    }

    const mod = u.protocol === "http:" ? http : https;
    const req = mod.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || (u.protocol === "http:" ? 80 : 443),
        path: u.pathname + u.search,
        method: "GET",
        headers: {
          "User-Agent": BROWSER_UA,
          "Accept": "*/*",
          "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8"
        }
      },
      (up) => {
        /* Redirect: o Google costuma redirecionar o .ics */
        if (up.statusCode >= 300 && up.statusCode < 400 && up.headers.location) {
          up.resume();
          const next = new URL(up.headers.location, urlStr).toString();
          return resolve(fetchUpstream(next, depth + 1));
        }
        const chunks = [];
        up.on("data", (c) => chunks.push(c));
        up.on("end", () =>
          resolve({
            status: up.statusCode,
            body: Buffer.concat(chunks),
            contentType: up.headers["content-type"] || "text/plain"
          })
        );
      }
    );

    req.setTimeout(20000, () => {
      req.destroy(new Error("Tempo esgotado ao buscar a fonte."));
    });
    req.on("error", reject);
    req.end();
  });
}

function handleProxy(req, res, urlObj) {
  const target = urlObj.searchParams.get("url");
  if (!target) return sendJson(res, 400, { erro: "Faltou o parâmetro ?url=" });

  fetchUpstream(target, 0)
    .then((r) => {
      log("proxy → " + maskUrl(target) + "  [" + r.status + ", " + r.body.length + " bytes]");
      res.writeHead(r.status, corsHeaders({
        "content-type": r.contentType,
        "content-length": r.body.length
      }));
      res.end(r.body);
    })
    .catch((e) => {
      if (e.forbidden) {
        log("proxy BLOQUEADO → domínio fora da allowlist");
        return sendJson(res, 403, { erro: e.message });
      }
      log("proxy ERRO → " + maskUrl(target) + "  (" + e.message + ")");
      sendJson(res, 502, { erro: e.message });
    });
}

/* ============================================================================
   CLIENTE IMAP MÍNIMO (módulo nativo tls, porta 993)
   Só LEITURA. Usa EXAMINE (read-only) e BODY.PEEK — nada é marcado como lido.
============================================================================ */

/* Encontra o fim da resposta com a tag dada, pulando literais {N}\r\n. */
function findTaggedEnd(buf, tag) {
  const tagPrefix = Buffer.from(tag + " ", "latin1");
  let i = 0;
  while (i < buf.length) {
    const nl = buf.indexOf("\r\n", i, "latin1");
    if (nl === -1) return -1;
    const line = buf.slice(i, nl).toString("latin1");

    const lit = /\{(\d+)\}$/.exec(line);
    if (lit) {
      i = nl + 2 + parseInt(lit[1], 10);
      continue;
    }
    if (
      nl - i >= tagPrefix.length &&
      buf.slice(i, i + tagPrefix.length).equals(tagPrefix)
    ) {
      return nl + 2;
    }
    i = nl + 2;
  }
  return -1;
}

/* Quebra a resposta do FETCH em blocos, um por mensagem, com seus literais. */
function parseFetchBlocks(buf) {
  const blocks = [];
  let cur = null;
  let i = 0;
  while (i < buf.length) {
    const nl = buf.indexOf("\r\n", i, "latin1");
    if (nl === -1) break;
    const line = buf.slice(i, nl).toString("latin1");

    const fm = /^\* (\d+) FETCH/i.exec(line);
    if (fm) {
      cur = { seq: parseInt(fm[1], 10), raw: line, lits: [] };
      blocks.push(cur);
    } else if (cur) {
      cur.raw += " " + line;
    }

    const lm = /\{(\d+)\}$/.exec(line);
    if (lm) {
      const len = parseInt(lm[1], 10);
      if (cur) cur.lits.push(buf.slice(nl + 2, nl + 2 + len));
      i = nl + 2 + len;
      continue;
    }
    i = nl + 2;
  }
  return blocks;
}

function imapQuote(s) {
  return '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
}

function openImap(host, user, pass) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let greeted = false;
    let buf = Buffer.alloc(0);
    let waiter = null;

    const sock = tls.connect({ host: host, port: 993, servername: host });

    function fail(err) {
      if (settled) return;
      settled = true;
      try { sock.destroy(); } catch (e) {}
      if (waiter) { const w = waiter; waiter = null; w.reject(err); }
      reject(err);
    }

    const session = {
      send(tag, cmd) {
        return new Promise((res, rej) => {
          waiter = { tag: tag, resolve: res, reject: rej };
          sock.write(tag + " " + cmd + "\r\n");
        });
      },
      close() {
        try { sock.write("zz LOGOUT\r\n"); } catch (e) {}
        setTimeout(() => { try { sock.destroy(); } catch (e) {} }, 200);
      }
    };

    sock.setTimeout(25000);
    sock.on("timeout", () => fail(new Error("Tempo esgotado com o servidor IMAP.")));
    sock.on("error", (e) => fail(new Error("Falha de conexão IMAP: " + e.message)));

    sock.on("data", (chunk) => {
      buf = Buffer.concat([buf, chunk]);

      if (!greeted) {
        const nl = buf.indexOf("\r\n", 0, "latin1");
        if (nl === -1) return;
        greeted = true;
        settled = true;
        buf = buf.slice(nl + 2);
        resolve(session);
      }

      if (waiter) {
        const end = findTaggedEnd(buf, waiter.tag);
        if (end !== -1) {
          const resp = buf.slice(0, end);
          buf = buf.slice(end);
          const w = waiter;
          waiter = null;
          w.resolve(resp);
        }
      }
    });
  });
}

/* ---------- decodificadores MIME ---------- */

function decodeCharset(bufr, charset) {
  const cs = (charset || "utf-8").toLowerCase();
  if (cs.indexOf("utf-8") !== -1 || cs.indexOf("utf8") !== -1) {
    return bufr.toString("utf8");
  }
  /* iso-8859-1 / windows-1252 e afins caem bem em latin1 */
  return bufr.toString("latin1");
}

function decodeQuotedPrintable(str) {
  return str
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (m, h) =>
      String.fromCharCode(parseInt(h, 16))
    );
}

function qpToBuffer(str) {
  const out = [];
  const clean = str.replace(/=\r?\n/g, "");
  for (let i = 0; i < clean.length; i++) {
    if (clean[i] === "=" && /[0-9A-Fa-f]{2}/.test(clean.substr(i + 1, 2))) {
      out.push(parseInt(clean.substr(i + 1, 2), 16));
      i += 2;
    } else {
      out.push(clean.charCodeAt(i) & 0xff);
    }
  }
  return Buffer.from(out);
}

function b64ToBuffer(str) {
  const clean = str.replace(/[^A-Za-z0-9+/=]/g, "");
  const trimmed = clean.slice(0, clean.length - (clean.length % 4));
  try { return Buffer.from(trimmed, "base64"); } catch (e) { return Buffer.alloc(0); }
}

/* =?UTF-8?B?...?=  e  =?UTF-8?Q?...?= */
function decodeMimeWords(str) {
  if (!str) return "";
  let out = String(str).replace(
    /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g,
    (m, charset, enc, data) => {
      try {
        if (enc.toUpperCase() === "B") {
          return decodeCharset(b64ToBuffer(data), charset);
        }
        return decodeCharset(qpToBuffer(data.replace(/_/g, " ")), charset);
      } catch (e) {
        return data;
      }
    }
  );
  /* encoded-words adjacentes ficam colados com espaço sobrando */
  return out.replace(/\?=\s+=\?/g, "").trim();
}

function parseHeaders(raw) {
  const text = raw.toString("latin1").replace(/\r\n[ \t]+/g, " ");
  const headers = {};
  text.split(/\r?\n/).forEach((line) => {
    const idx = line.indexOf(":");
    if (idx === -1) return;
    const key = line.slice(0, idx).trim().toLowerCase();
    const val = line.slice(idx + 1).trim();
    if (key) headers[key] = val;
  });
  return headers;
}

function stripHtml(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n");
}

function decodePart(bodyStr, encoding, charset) {
  const enc = (encoding || "").toLowerCase();
  if (enc.indexOf("base64") !== -1) return decodeCharset(b64ToBuffer(bodyStr), charset);
  if (enc.indexOf("quoted-printable") !== -1) {
    return decodeCharset(qpToBuffer(bodyStr), charset);
  }
  return decodeCharset(Buffer.from(bodyStr, "latin1"), charset);
}

/* Extrai um trecho legível do corpo, preferindo text/plain. */
function extractSnippet(textBuf, headers) {
  const ctype = headers["content-type"] || "text/plain";
  const raw = textBuf.toString("latin1");

  const bm = /boundary="?([^";\r\n]+)"?/i.exec(ctype);
  if (/multipart/i.test(ctype) && bm) {
    const boundary = "--" + bm[1];
    const parts = raw.split(boundary);
    let plain = null;
    let html = null;

    parts.forEach((part) => {
      const sep = part.indexOf("\r\n\r\n");
      if (sep === -1) return;
      const ph = parseHeaders(Buffer.from(part.slice(0, sep), "latin1"));
      const pbody = part.slice(sep + 4);
      const pct = ph["content-type"] || "";
      const penc = ph["content-transfer-encoding"] || "";
      const pcs = (/charset="?([^";\r\n]+)"?/i.exec(pct) || [])[1];

      if (/text\/plain/i.test(pct) && plain === null) {
        plain = decodePart(pbody, penc, pcs);
      } else if (/text\/html/i.test(pct) && html === null) {
        html = decodePart(pbody, penc, pcs);
      }
    });

    if (plain) return plain;
    if (html) return stripHtml(html);
  }

  const cs = (/charset="?([^";\r\n]+)"?/i.exec(ctype) || [])[1];
  let body = decodePart(raw, headers["content-transfer-encoding"], cs);
  if (/text\/html/i.test(ctype)) body = stripHtml(body);
  return body;
}

function cleanSnippet(s) {
  return String(s || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim()
    .slice(0, 500);
}

/* ---------- busca principal de e-mails ---------- */

async function buscarEmails(host, user, pass, quantidade) {
  const n = Math.max(1, Math.min(50, parseInt(quantidade, 10) || 20));
  const s = await openImap(host, user, pass);

  try {
    const loginResp = (await s.send("a1", "LOGIN " + imapQuote(user) + " " + imapQuote(pass)))
      .toString("latin1");
    if (!/^a1 OK/im.test(loginResp)) {
      const err = new Error(
        "Senha de app inválida ou verificação em 2 etapas desativada — refaça em myaccount.google.com/apppasswords"
      );
      err.login = true;
      throw err;
    }

    /* EXAMINE = somente leitura. Nada é alterado na caixa. */
    const exResp = (await s.send("a2", "EXAMINE INBOX")).toString("latin1");
    const em = /\* (\d+) EXISTS/i.exec(exResp);
    const total = em ? parseInt(em[1], 10) : 0;
    if (total === 0) return [];

    const start = Math.max(1, total - n + 1);

    /* BODY.PEEK — CRÍTICO: não marca como lido. */
    const fetchCmd =
      "FETCH " + start + ":" + total + " (FLAGS " +
      "BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE MESSAGE-ID CONTENT-TYPE CONTENT-TRANSFER-ENCODING)] " +
      "BODY.PEEK[TEXT]<0.3000>)";

    const fetchResp = await s.send("a3", fetchCmd);
    const blocks = parseFetchBlocks(fetchResp);

    const emails = blocks.map((b) => {
      const headers = parseHeaders(b.lits[0] || Buffer.alloc(0));
      const textBuf = b.lits[1] || Buffer.alloc(0);

      const fromRaw = decodeMimeWords(headers["from"] || "");
      const nameMatch = /^\s*"?([^"<]*?)"?\s*<([^>]+)>/.exec(fromRaw);
      const remetente = nameMatch
        ? (nameMatch[1].trim() || nameMatch[2].trim())
        : fromRaw.replace(/[<>]/g, "").trim();

      let data = null;
      if (headers["date"]) {
        const d = new Date(headers["date"]);
        if (!isNaN(d.getTime())) data = d.toISOString();
      }

      const id =
        (headers["message-id"] || "").replace(/[<>]/g, "").trim() ||
        host + ":" + user + ":" + b.seq;

      return {
        id: id,
        remetente: remetente || "(desconhecido)",
        assunto: decodeMimeWords(headers["subject"] || "") || "(sem assunto)",
        data: data,
        trecho: cleanSnippet(extractSnippet(textBuf, headers)),
        lido: /\\Seen/i.test(b.raw)
      };
    });

    emails.reverse(); /* mais recentes primeiro */
    return emails;
  } finally {
    s.close();
  }
}

function handleEmails(req, res) {
  let body = "";
  let tooBig = false;

  req.on("data", (c) => {
    body += c;
    if (body.length > 64 * 1024) {
      tooBig = true;
      req.destroy();
    }
  });

  req.on("end", () => {
    if (tooBig) return sendJson(res, 413, { erro: "Corpo grande demais." });

    let payload;
    try {
      payload = JSON.parse(body);
    } catch (e) {
      return sendJson(res, 400, { erro: "JSON inválido." });
    }

    const host = String(payload.host || "").trim().toLowerCase();
    const usuario = String(payload.usuario || "").trim();
    const senhaApp = String(payload.senhaApp || "").replace(/\s+/g, "");
    const quantidade = payload.quantidade;

    if (IMAP_ALLOWLIST.indexOf(host) === -1) {
      log("imap BLOQUEADO → host fora da allowlist: " + host);
      return sendJson(res, 403, {
        erro: "Host IMAP fora da allowlist: " + host +
              ". Adicione em IMAP_ALLOWLIST no server.js."
      });
    }
    if (!usuario || !senhaApp) {
      return sendJson(res, 400, { erro: "Informe usuário e senha de app." });
    }

    /* Log sem vazar credencial. */
    log("imap → " + host + " (" + mask(usuario) + ") buscando " + (quantidade || 20));

    buscarEmails(host, usuario, senhaApp, quantidade)
      .then((emails) => {
        log("imap ✓ " + emails.length + " e-mails de " + mask(usuario));
        sendJson(res, 200, { emails: emails });
      })
      .catch((e) => {
        log("imap ✗ " + mask(usuario) + " → " + e.message);
        sendJson(res, e.login ? 401 : 502, { erro: e.message });
      });
  });
}

/* ============================================================================
   SERVIDOR
============================================================================ */

const server = http.createServer((req, res) => {
  /* Preflight — sem isso o POST com JSON falha vindo de um arquivo local. */
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders());
    return res.end();
  }

  let urlObj;
  try {
    urlObj = new URL(req.url, "http://" + HOST + ":" + PORT);
  } catch (e) {
    return sendJson(res, 400, { erro: "Requisição inválida." });
  }

  if (req.method === "GET" && urlObj.pathname === "/ping") {
    return sendJson(res, 200, { antena: "online", versao: "1.0" });
  }
  if (req.method === "GET" && urlObj.pathname === "/proxy") {
    return handleProxy(req, res, urlObj);
  }
  if (req.method === "POST" && urlObj.pathname === "/emails") {
    return handleEmails(req, res);
  }

  sendText(res, 404, "Rota não encontrada. Use /ping, /proxy?url=... ou POST /emails.");
});

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.error("");
    console.error("  ✗ A porta " + PORT + " já está ocupada.");
    console.error("    Provavelmente a antena já está rodando em outro terminal.");
    console.error("    Feche o outro terminal ou mate o processo e tente de novo.");
    console.error("");
    process.exit(1);
  }
  if (e.code === "EACCES") {
    console.error("");
    console.error("  ✗ Sem permissão para abrir a porta " + PORT + ".");
    console.error("");
    process.exit(1);
  }
  console.error("  ✗ Erro no servidor: " + e.message);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log("");
  console.log("  ⚡ ANTENA DO JARVIS ONLINE — porta " + PORT + ". Pode abrir o jarvis.html.");
  console.log("");
  console.log("     escutando em .... http://" + HOST + ":" + PORT + "  (só esta máquina)");
  console.log("     proxy liberado .. " + PROXY_ALLOWLIST.join(", "));
  console.log("     imap liberado ... " + IMAP_ALLOWLIST.join(", "));
  console.log("");
  console.log("     Deixe este terminal aberto. Ctrl+C encerra a antena.");
  console.log("");
});
