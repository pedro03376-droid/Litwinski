# 🗄️ Fase 1 — Espelho no Postgres (piloto: goleiros)

Esta fase faz o Postgres receber uma **cópia durável** dos goleiros, **sem mudar
nada** no funcionamento atual do app. O Firebase continua sendo o principal.

- ✅ **Aditivo e reversível** — não apaga nem move nada.
- ✅ **Desligado por padrão** — só liga quando você quiser.
- ✅ **Best-effort** — se o backend estiver fora do ar, o app segue normal.
- ✅ **Sem duplicatas** — o servidor usa "criar-ou-atualizar" por origem.

---

## O que já está no código

**Backend** (goleiros):
- Nova coluna `externalId` (código de origem) + índice.
- Migração que cria a coluna **sozinha no boot** (o app roda migrações
  automaticamente em produção — `migrationsRun`).
- Nova rota `POST /api/v1/goalkeepers/sync` — cria-ou-atualiza por
  `(teamId, externalId)`, idempotente (não duplica).

**App** (frontend):
- Função de espelho que, ao salvar um goleiro, também envia para o backend.
- **Interruptor desligado** por padrão.

---

## Passo 1 — Redeploy do backend na Railway

O código do backend mudou (coluna + migração + rota). Para valer em produção:

1. Faça o **deploy** do backend atualizado na Railway (push na branch que a
   Railway acompanha, ou "Redeploy" no painel do serviço).
2. No boot, o app aplica a migração **sozinho** e cria a coluna `externalId`.
   - Não precisa rodar comando manual.
   - A migração é idempotente (`IF NOT EXISTS`) — segura mesmo se rodar de novo.
3. (Opcional) Confira nos **logs** da Railway a linha de migração executada, ou
   que o serviço subiu sem erros.

> Nada no app muda ainda — o espelho continua **desligado**.

## Passo 2 — Pré-requisitos para o espelho funcionar

O espelho só envia quando **todos** forem verdade (senão ele simplesmente não faz
nada, sem erro):

- Você está **conectado ao backend** (em *Config. → Backend*, aparece
  "Conectado") com um usuário de papel **Admin** ou **Comissão Técnica**.
- Há um **clube/workspace do backend ativo** (o mesmo usado em Treinos).
- O goleiro tem no mínimo **nome, data de nascimento e categoria**.

## Passo 3 — Ligar o espelho (só goleiros)

No navegador do aparelho de teste, abra o **Console** (F12 → Console) e rode:

```js
localStorage.setItem('gkhub_pg_mirror', '1'); location.reload();
```

Pronto: a partir daí, **cada goleiro que você salvar** é copiado para o Postgres.

**Para desligar** a qualquer momento:

```js
localStorage.removeItem('gkhub_pg_mirror'); location.reload();
```

## Passo 4 — Conferir

- Salve/edite um goleiro no app.
- No backend, confira a tabela `goalkeepers` (por exemplo em
  `GET /api/v1/goalkeepers`): o goleiro aparece com o `externalId` preenchido.
- Edite o mesmo goleiro e salve de novo → **o mesmo registro é atualizado**
  (não cria um segundo). É assim que sabemos que está sem duplicatas.

---

## Reverter

- **Desligar o espelho**: `localStorage.removeItem('gkhub_pg_mirror')` (Passo 3).
- **Backend**: a rota e a coluna são inofensivas mesmo desligadas; se quiser
  remover a coluna, a migração tem o `down` (reverte). Não é necessário.

## Depois que validar

Deu certo com goleiros → repetimos o mesmo padrão para **partidas** e **scouts**,
uma coleção por vez, e depois avaliamos tornar o Postgres o principal (Fase 2).
