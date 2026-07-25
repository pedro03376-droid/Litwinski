# 🤖 IA por Gemini numa mini-função grátis (Cloudflare Workers)

Substitui o backend pesado só para a **análise por IA**. Vantagens:
- **Não hiberna** (sem cold start).
- **Grátis** (Cloudflare Workers: 100 mil requisições/dia no plano free).
- A **chave da Gemini fica secreta** no servidor (nunca aparece no app).

O código está em `ai-worker/worker.js`.

---

## Passo 1 — Chave da Gemini (grátis)
1. Entre em **aistudio.google.com** → **Get API key** → crie a chave.
2. Guarde (vamos usar no Passo 3).

## Passo 2 — Publicar o Worker
No seu computador, dentro da pasta `ai-worker` do projeto:

```bash
cd ai-worker
npx wrangler login          # abre o navegador p/ logar na Cloudflare (conta grátis)
npx wrangler deploy         # publica o worker
```

No fim, ele mostra a URL, algo como:
`https://gkhub-ai.SEU-SUBDOMINIO.workers.dev`  ← **anote**.

## Passo 3 — Colocar a chave secreta no Worker
```bash
npx wrangler secret put GEMINI_API_KEY
# cole a chave da Gemini quando pedir
```
Pronto — a chave fica só na Cloudflare, nunca no app.

Teste no navegador: `https://gkhub-ai.SEU-SUBDOMINIO.workers.dev/health`
→ deve mostrar `{"status":"ok","service":"gkhub-ai"}`.

## Passo 4 — Ligar a IA no app
No site do GK Hub, abra o Console (F12) e rode:

```js
setAiUrl('https://gkhub-ai.SEU-SUBDOMINIO.workers.dev')
```

Pronto. Agora os botões de **Análise IA** usam a Gemini pela sua função.
(Para desligar e voltar ao modo regras: `setAiUrl('')`.)

---

## Observações
- **Sem configurar isto**, a análise por IA continua funcionando em **modo regras/heurística** — nada quebra.
- **CORS:** o worker já libera o site `https://pedro03376-droid.github.io`. Se um dia mudar o domínio do app, ajuste `ALLOW_ORIGIN` no topo de `worker.js` e publique de novo.
- **Custo:** dentro do uso de um clube, fica tranquilamente no tier grátis da Cloudflare e da Gemini.
