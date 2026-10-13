# Partes arquivadas

Nada aqui foi apagado de verdade — está tudo no histórico do git, acessível
por uma tag. Esta página existe para que ninguém precise garimpar commits
para entender o que saiu, por quê, e como trazer de volta.

---

## App Android em Flutter — `mobile/`

**Arquivado em:** outubro de 2026
**Tag de recuperação:** `arquivo/flutter-2026-10`
**Tamanho:** 84 arquivos, ~15.200 linhas de Dart, 11 módulos
(dashboard, goleiros, partidas, performance, relatórios, análise por IA,
treinos, vídeos, notificações, autenticação, início)

### Por que saiu

O projeto decidiu focar no **app web de goleiros**, com lançamento previsto
para janeiro/fevereiro de 2027. O app Flutter era um produto paralelo que:

- estava **parado havia 4 meses**, enquanto o app web recebia mudanças diárias;
- apontava para `https://litwinski-production.up.railway.app`, um backend
  **cujo estado não foi verificado** e que o app web não usa mais (o web é
  local-first e fala direto com o Firebase);
- ficava **fora de todas as auditorias** de segurança, desempenho e
  acessibilidade feitas no app web, por não compartilhar código com ele;
- usava o mesmo projeto Firebase, com uma chave de API Android própria.

Manter dois produtos meio-prontos dividiria a atenção de uma equipe de uma
pessoa às vésperas de um lançamento. Arquivar foi uma decisão de foco, não um
julgamento sobre a qualidade do código.

### Como recuperar

```sh
git checkout arquivo/flutter-2026-10 -- mobile/
git checkout arquivo/flutter-2026-10 -- .github/workflows/build-apk.yml
git checkout arquivo/flutter-2026-10 -- .github/workflows/flutter-test.yml
```

### Antes de revivê-lo, considere

1. **O backend pode não existir mais.** Confirme o Railway antes de qualquer
   coisa; sem ele o app não tem de onde ler.
2. **O modelo de dados mudou.** O app web guarda tudo no aparelho e sincroniza
   direto com o Firebase RTDB, isolado por clube em `/clubs/<codigo>`. O
   Flutter fala com uma API REST. São arquiteturas diferentes: reviver sem
   reescrever a camada de dados criaria dois conjuntos de dados que não se
   enxergam.
3. **Para estar na Play Store, pode não ser necessário.** O app web é um PWA e
   pode ser empacotado e publicado na loja, com o mesmo código do site. Custa
   uma conta de desenvolvedor (US$ 25, uma vez) em vez de manter um segundo
   produto.

### Pendência que ficou

A **chave de API Android** do Firebase (`AIzaSyA3by...`) continua existindo no
Google Cloud e **sem restrição de aplicativo**. Enquanto nenhum app Android
usar o projeto, o mais seguro é **excluí-la** no Console
(APIs e serviços → Credenciais). Se um dia o app voltar, basta criar outra.
