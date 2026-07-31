# 🔒 Regras de Segurança do Firebase (versão atual — app local + nuvem)

Estas regras corrigem os erros **401** de sincronização e mantêm cada clube
isolado. Servem para a arquitetura atual: **sem backend central**, cada clube
separado pelo seu **código do clube** (namespace `/clubs/<código>`).

## O que elas fazem
- Só quem está **logado (Google)** lê/grava — sem login, nada.
- O acesso é dentro de **um clube específico** (você precisa ter o **código do
  clube**). Não dá para **listar** todos os clubes nem "cair" no de outro.
- O 2FA e a sessão de login **nunca** vão para a nuvem (isso é do app, não das regras).

---

## Onde colar
Firebase Console → seu projeto → **Realtime Database** → aba **Regras (Rules)** →
substitua tudo pelo conteúdo abaixo → **Publicar**.

```json
{
  "rules": {
    "clubs": {
      "$club": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    },
    "clubMembers": {
      "$club": {
        "$uid": {
          ".read": "auth != null",
          ".write": "auth != null"
        }
      }
    }
  }
}
```

## Depois de publicar — como conferir que a sincronização voltou
1. No app: **Config. do Clube → 🔄 Sincronizar agora**.
2. Deve aparecer **"Tudo sincronizado"** (e o indicador no topo fica **🟢 Online**).
3. Teste real: abra o app **em outro aparelho/navegador**, entre com o **mesmo
   Google** e o **mesmo código do clube** (*Config. do Clube → Código do clube*)
   — seus goleiros/partidas/treinos devem aparecer lá também.

> Se **ainda** der 401: confirme que você **entrou com o Google** (sem login o
> Firebase recusa) e que publicou as regras acima (não as antigas de "membros").

## Observação
Estas regras usam o **código do clube como segredo** para separar clubes — que
é exatamente o modelo de compartilhamento do app (você passa o código só para a
sua comissão). É simples e confiável. Se um dia quiser um controle mais rígido
(cada usuário precisar ser "aprovado" no clube), dá para evoluir para regras por
membro — mas aí é preciso um passo a mais no app para registrar os membros.
