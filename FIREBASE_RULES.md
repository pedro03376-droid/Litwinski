# 🔒 Regras de Segurança do Firebase — Isolamento por Clube

Estas regras fazem o **servidor** (e não só o app) garantir que **cada usuário só
acessa os dados do clube ao qual pertence**. Hoje o isolamento é feito apenas no
aplicativo; com estas regras, mesmo alguém técnico não consegue ler/gravar dados
de outro clube.

## Como funciona

- Cada usuário que entra num clube grava uma **associação**:
  `/clubMembers/<código-do-clube>/<seu-id> = true`.
  O app faz isso **sozinho** ao sincronizar (você não precisa fazer nada).
- Cada usuário só pode criar/apagar a **própria** associação.
- Os dados do clube (`/clubs/<código>/…`) só podem ser lidos/gravados por **membros
  daquele clube**.

---

## ⚠️ ORDEM IMPORTANTE (para não se trancar para fora)

Faça **nesta ordem**:

1. **Publique o app atualizado** (já está no ar) e **abra-o uma vez logado** em cada
   aparelho que usa o sistema. Isso grava a sua associação ao clube **enquanto as
   regras antigas ainda permitem**.
   - Confirme em *Config. do Clube → 🔄 Sincronizar agora* (aparecer "Tudo
     sincronizado" = associação gravada).
2. **Só depois** cole as regras abaixo no Firebase e publique.

> Se colar as regras **antes** de abrir o app atualizado, o acesso fica bloqueado
> até a associação ser gravada — mas basta abrir o app e sincronizar que ele grava
> a associação e o acesso volta. Ninguém perde dados; no pior caso, é só abrir e
> sincronizar.

---

## Onde colar

Firebase Console → seu projeto → **Realtime Database** → aba **Regras (Rules)** →
substitua tudo pelo conteúdo abaixo → **Publicar**.

```json
{
  "rules": {
    "clubMembers": {
      "$club": {
        "$uid": {
          ".read": "auth != null && auth.uid === $uid",
          ".write": "auth != null && auth.uid === $uid",
          ".validate": "newData.isBoolean()"
        }
      }
    },
    "clubs": {
      "$club": {
        ".read": "auth != null && root.child('clubMembers').child($club).child(auth.uid).exists()",
        ".write": "auth != null && root.child('clubMembers').child($club).child(auth.uid).exists()"
      }
    }
  }
}
```

## O que isso garante

- ✅ Um clube **nunca** lê nem grava dados de outro clube (imposto no servidor).
- ✅ Só é possível acessar depois de **entrar** (logar com Google) — sem login, nada.
- ✅ Cada usuário administra só a **própria** associação (não remove ninguém à força).
- ✅ Qualquer outro caminho no banco fica **bloqueado por padrão**.

## Continua igual (por segurança)

- O **segredo 2FA** e a **sessão de login** **nunca** sobem para a nuvem.
- Quem tiver o **código do clube** ainda consegue entrar (mesmo modelo de hoje) —
  a diferença é que agora todo acesso passa a exigir uma associação registrada e
  verificada pelo servidor. Para controle mais rígido (convite/aprovação de
  membros), é o próximo passo possível.
