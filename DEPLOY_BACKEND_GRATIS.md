# 🚀 Mover o backend para hospedagem GRÁTIS (Railway → Render + Neon)

O Railway virou pago. Este guia move o backend para um host **gratuito**, sem
perder nada. Enquanto você faz isso, **o app continua funcionando** (cadastros e
treinos salvam no aparelho e sincronizam depois).

**Recomendação:** **Neon** (banco Postgres grátis, não expira) + **Render**
(roda o backend via Docker, grátis). Só precisa de conta nos dois (login com
GitHub/Google). O "cold start" do plano grátis não incomoda, porque o Treinos+
agora funciona offline.

---

## Passo 1 — Banco de dados grátis (Neon)

1. Crie conta em **neon.tech** (pode entrar com o GitHub).
2. **Create project** (nome: `gkhub`, região mais perto do Brasil).
3. Copie a **Connection string** (formato `postgresql://usuario:senha@host/db?sslmode=require`).
   - É a sua **DATABASE_URL**. Guarde.

## Passo 2 — Backend grátis (Render)

1. Crie conta em **render.com** (entre com o GitHub).
2. **New → Blueprint** e selecione o repositório **`pedro03376-droid/Litwinski`**.
   - O Render lê o arquivo **`render.yaml`** (já está no projeto) e monta o serviço sozinho.
3. Quando pedir as variáveis marcadas como “manuais”, preencha:
   - **DATABASE_URL** = a string do Neon (Passo 1).
   - **DB_SYNC** = `true`  ← **só no primeiro deploy**, para criar as tabelas.
   - (Opcional) **GEMINI_API_KEY** para IA grátis (pegue em *aistudio.google.com*).
4. **Create / Deploy** e aguarde o build terminar (uns minutos).
5. Confira que subiu abrindo no navegador:
   `https://SEU-APP.onrender.com/api/v1/health` → deve mostrar `{"status":"ok",...}`.
6. **Importante:** depois que funcionar, volte nas variáveis, mude **DB_SYNC** para
   `false` e faça **Manual Deploy → Deploy latest commit** (o `true` era só para
   criar as tabelas uma vez).

> Anote a URL do serviço, algo como `https://gkhub-backend.onrender.com`.

## Passo 3 — Apontar o app para o novo backend

Não precisa refazer o deploy do app. No navegador (F12 → Console), rode:

```js
setBackendUrl('https://SEU-APP.onrender.com')
```

O app recarrega e passa a usar o novo backend. (Para voltar ao padrão:
`setBackendUrl('')`.)

- Confira em **Config. do Clube → Backend**: deve aparecer conectado após você
  logar de novo.
- Os treinos que o cliente criou **offline** sincronizam sozinhos.

---

## Variáveis de ambiente (referência)

| Variável | Obrigatória? | Para quê |
|---|---|---|
| `DATABASE_URL` | ✅ | Banco (Neon) |
| `JWT_SECRET` | ✅ (o Render gera) | Login |
| `NODE_ENV=production` | ✅ | Modo produção |
| `DB_SYNC` | 1ª vez = `true`, depois `false` | Criar tabelas no 1º deploy |
| `ALLOWED_ORIGINS` | recomendado | Libera o site (já vem com o GitHub Pages) |
| `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` | opcional | IA (sem elas, usa heurística) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` / `SUPABASE_BUCKET_*` | opcional | Só se usar upload de vídeo/foto |

## Alternativas de host (se preferir)
- **Koyeb** ou **Fly.io**: também rodam o Docker do backend de graça (Fly pede
  instalar um programa no computador — mais técnico).
- O **banco** pode ficar no Neon em qualquer um dos casos.

## Dúvidas comuns
- **“Primeira resposta demora”**: no plano grátis o servidor “dorme” e acorda em
  ~30–60s na 1ª chamada. Normal. O Treinos+ funciona offline nesse meio-tempo.
- **Erro de CORS**: confirme `ALLOWED_ORIGINS=https://pedro03376-droid.github.io`.
- **Treino não salva no servidor**: veja se `DB_SYNC=true` rodou uma vez (tabelas
  criadas) e se você está conectado em *Config. do Clube → Backend*.
