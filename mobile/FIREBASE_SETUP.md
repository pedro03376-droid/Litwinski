# Firebase Cloud Messaging (Push Notifications) — Setup

O código de push já está integrado (Flutter + backend). Para **ativar** a entrega
real, faltam apenas os arquivos de configuração do Firebase. Sem eles o app roda
normalmente — o push fica desativado (degradação graciosa).

## 1. Criar / abrir o projeto no Firebase

1. Acesse https://console.firebase.google.com
2. Crie um projeto (ou use um existente) — ex.: `gkhub`

## 2. Backend (Railway) — credencial do servidor

1. Firebase Console → ⚙️ **Configurações do projeto** → aba **Contas de serviço**
2. **Gerar nova chave privada** → baixa um `.json`
3. Railway → serviço do backend → **Variables** → nova variável:
   - Nome: `FIREBASE_SERVICE_ACCOUNT_JSON`
   - Valor: cole o **conteúdo inteiro** do `.json`
4. O Railway reinicia. Nos logs deve aparecer: `Firebase Admin initialized`

## 3. Android — `google-services.json`

1. Firebase Console → **Adicionar app** → ícone Android
2. **Nome do pacote**: `com.gkhub.app` (precisa ser exatamente este)
3. Baixe o `google-services.json`
4. Coloque o arquivo em: `mobile/android/app/google-services.json`

> O plugin Gradle é aplicado **automaticamente** apenas quando esse arquivo existe
> (ver `android/app/build.gradle`). Sem ele, o build continua funcionando (CI verde).

## 4. iOS — `GoogleService-Info.plist` (opcional, quando for publicar no iOS)

1. Firebase Console → **Adicionar app** → ícone iOS
2. **Bundle ID**: o mesmo do Xcode (ex.: `com.gkhub.app`)
3. Baixe o `GoogleService-Info.plist` e adicione em `mobile/ios/Runner/`
4. No Apple Developer, habilite **Push Notifications** + suba a chave **APNs**
   no Firebase Console → Configurações → **Cloud Messaging** → Apple app configuration

## 5. Testar

1. Rebuild do app com o `google-services.json` no lugar
2. Faça login → o app pede permissão de notificação e registra o token
   (chama `POST /notifications/subscribe`)
3. Confira no banco: a tabela `push_subscriptions` deve ter uma linha `isActive=true`
4. Dispare qualquer notificação no backend (ex.: gere um relatório) — o push chega.

## Como funciona no código

- `mobile/lib/core/notifications/push_notification_service.dart` — init do Firebase,
  permissão, token, exibição de notificações em foreground, refresh de token
- `mobile/lib/core/providers/auth_provider.dart` — registra o token após login e
  no `_checkAuth`; remove (`unsubscribe` + `deleteToken`) no logout
- Backend `FirebaseService` — entrega via `firebase-admin` para todos os tokens
  ativos do usuário a cada `NotificationsService.create()`
