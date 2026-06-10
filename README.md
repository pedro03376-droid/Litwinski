# 🥅 GKHUB – Goalkeeper Performance Platform

Plataforma profissional de acompanhamento, análise e evolução de goleiras de futsal.

---

## Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Mobile | Flutter 3.x |
| Web | Flutter Web |
| Backend | NestJS 10 |
| Banco de Dados | PostgreSQL 15 |
| Autenticação | JWT (Access + Refresh tokens) |
| Armazenamento | Supabase Storage |
| Relatórios | PDFKit |
| Gráficos (app) | FL Chart |
| Upload Excel | ExcelJS |
| State Management | Riverpod 2 |
| Container | Docker / Docker Compose |

---

## Estrutura do Projeto

```
gkhub/
├── backend/               # API NestJS
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/            # JWT authentication
│   │   │   ├── users/           # Gerenciamento de usuários
│   │   │   ├── teams/           # Equipes
│   │   │   ├── goalkeepers/     # Goleiras (CRUD + stats + evolução)
│   │   │   ├── matches/         # Jogos
│   │   │   ├── scouts/          # Scout de jogo + heatmap
│   │   │   ├── training/        # Treinos + exercícios
│   │   │   ├── performance/     # Índices de performance + ranking
│   │   │   ├── videos/          # Upload vídeos/fotos (Supabase)
│   │   │   ├── reports/         # Geração de PDFs
│   │   │   ├── ai-analysis/     # Análise inteligente automática
│   │   │   ├── notifications/   # Notificações
│   │   │   ├── import/          # Importação Excel (.xlsx)
│   │   │   ├── seasons/         # Temporadas
│   │   │   └── competitions/    # Competições
│   │   ├── common/              # Guards, filters, interceptors
│   │   └── config/              # Configurações
│   └── Dockerfile
├── mobile/                # App Flutter (mobile + web)
│   └── lib/
│       ├── core/          # Theme, Router, Network, Providers
│       ├── features/      # Módulos por funcionalidade
│       └── shared/        # Widgets compartilhados
├── docker/                # Nginx config, SQL init
├── docker-compose.yml
└── .env.example
```

---

## Módulos e Funcionalidades

### Perfis de Usuário
| Perfil | Permissões |
|---|---|
| **Administrador** | Gerenciar usuários, equipes, atletas, editar tudo |
| **Comissão Técnica** | Scouts, treinos, jogos, vídeos, relatórios |
| **Visualizador** | Somente consulta |

### Módulo de Goleiras
- Cadastro completo (nome, foto, nascimento, altura, peso, mão/pé dominante)
- Vinculação a equipe e categoria
- Dashboard individual com estatísticas e evolução

### Scout de Jogo
Registro detalhado por partida:
- Defesas Altas (Dir/Esq)
- Defesas Baixas (Dir/Esq)
- Defesa Central
- Distribuição (Pé Certo/Errado, Mão Certa)
- Interceptações e Esquadros
- Posicionamento Base (Esq/Dir)
- Gols Sofridos (Dentro/Fora da Área)
- **Heatmap visual** da quadra

### Performance
Notas automáticas de 0 a 10 em 9 dimensões:
- Reflexo, Posicionamento, Defesa Alta, Defesa Baixa
- Interceptação, Saída do Gol, Jogo com os Pés, Distribuição, Tomada de Decisão

Classificação: **Elite** (≥9) | **Excelente** (≥8) | **Boa** (≥7) | **Regular** (≥5) | **Em Desenvolvimento** (<5)

### IA Analítica
Gerada automaticamente após jogos e treinos:
- ✅ Pontos Fortes
- ⚠️ Pontos de Atenção  
- 📈 Notas de Evolução
- 💡 Sugestões de Treino

### Relatórios PDF
- Por jogo, por período, por temporada
- Comparativos (atleta vs atleta, mês vs mês)
- Layout profissional com gráficos e heatmaps
- Download e compartilhamento direto

### Importação Excel
- Assistente visual de mapeamento de colunas
- Compatível com planilhas históricas
- Importação de jogos, treinos e atletas

---

## Configuração e Deploy

### Pré-requisitos
- Docker 24+
- Docker Compose 2+
- Node.js 20+ (para desenvolvimento)
- Flutter 3.19+ (para desenvolvimento mobile)

### Quick Start (Docker)

```bash
# 1. Clone o repositório
git clone https://github.com/pedro03376-droid/litwinski.git
cd litwinski

# 2. Configure variáveis de ambiente
cp .env.example .env
# Edite o .env com suas configurações

# 3. Suba o ambiente
docker-compose up -d

# 4. A API estará disponível em:
#    http://localhost:3000/api/v1
#    Swagger: http://localhost:3000/api/docs
```

### Backend (desenvolvimento local)

```bash
cd backend
npm install
npm run start:dev

# Migrations (quando necessário)
npm run migration:run
```

### Flutter App (desenvolvimento local)

```bash
cd mobile
flutter pub get

# Mobile
flutter run

# Web
flutter run -d chrome --dart-define=API_BASE_URL=http://localhost:3000/api/v1
```

---

## API Endpoints

### Autenticação
```
POST   /api/v1/auth/login
POST   /api/v1/auth/register
GET    /api/v1/auth/profile
```

### Goleiras
```
GET    /api/v1/goalkeepers
POST   /api/v1/goalkeepers
GET    /api/v1/goalkeepers/:id
PATCH  /api/v1/goalkeepers/:id
DELETE /api/v1/goalkeepers/:id
GET    /api/v1/goalkeepers/:id/stats
GET    /api/v1/goalkeepers/:id/evolution?period=monthly
```

### Jogos
```
GET    /api/v1/matches
POST   /api/v1/matches
GET    /api/v1/matches/:id
GET    /api/v1/matches/stats/:goalkeeperId
GET    /api/v1/matches/recent/:goalkeeperId
```

### Scout
```
GET    /api/v1/scouts/match/:matchId
POST   /api/v1/scouts/match/:matchId
PATCH  /api/v1/scouts/:id
PATCH  /api/v1/scouts/:id/heatmap
GET    /api/v1/scouts/stats/:goalkeeperId
```

### Treinos
```
GET    /api/v1/training
POST   /api/v1/training
GET    /api/v1/training/:id
POST   /api/v1/training/:id/exercises
POST   /api/v1/training/exercises/:exerciseId/results
GET    /api/v1/training/stats/:goalkeeperId
```

### Performance
```
GET    /api/v1/performance/:goalkeeperId
GET    /api/v1/performance/evolution/:goalkeeperId?period=monthly
GET    /api/v1/performance/ranking
GET    /api/v1/performance/compare
```

### IA Analítica
```
GET    /api/v1/ai-analysis/goalkeeper/:goalkeeperId
GET    /api/v1/ai-analysis/match/:matchId
GET    /api/v1/ai-analysis/training/:trainingSessionId
```

### Relatórios
```
GET    /api/v1/reports
POST   /api/v1/reports/match
POST   /api/v1/reports/period
GET    /api/v1/reports/:id/download
```

### Importação
```
POST   /api/v1/import/preview
POST   /api/v1/import/matches
POST   /api/v1/import/goalkeepers
```

### Vídeos/Fotos
```
GET    /api/v1/videos
POST   /api/v1/videos/upload
PATCH  /api/v1/videos/:id
DELETE /api/v1/videos/:id
```

---

## Banco de Dados (Entidades)

```
users               – Usuários do sistema
teams               – Equipes
goalkeepers         – Goleiras (vinculadas à equipe)
matches             – Jogos
match_scouts        – Dados de scout por jogo
training_sessions   – Sessões de treino
exercises           – Exercícios por sessão
exercise_results    – Resultados dos exercícios
performance_indexes – Índices de performance calculados
videos              – Vídeos e fotos
reports             – Relatórios gerados
ai_analyses         – Análises de IA por jogo/treino
notifications       – Notificações
seasons             – Temporadas
competitions        – Competições
```

---

## Design System

Inspirado em SofaScore, Hudl, StatsBomb e Wyscout.

### Dark Mode (padrão)
- Background: `#0D0D1A`
- Surface: `#161628`
- Cards: `#1E1E35`
- Primary: `#00D4FF` (cyan)
- Success: `#00C853`
- Error: `#FF3D57`

### Tipografia
- Família: **Inter**
- Pesos: Regular (400), Medium (500), SemiBold (600), Bold (700), ExtraBold (800)

---

## Segurança

- JWT com expiração configurável
- Refresh tokens
- Roles: `admin`, `technical_staff`, `viewer`
- Guards nas rotas sensíveis
- Validação de inputs (class-validator)
- Helmet + CORS configurados
- Dados de treino e performance protegidos por autenticação

---

## Roadmap

- [ ] Push notifications (FCM)
- [ ] Modo offline (Hive local storage)
- [ ] Comparativo avançado de goleiras
- [ ] Integração com câmera para análise de vídeo
- [ ] IA avançada com OpenAI GPT
- [ ] Multi-tenant (múltiplos clubes)
- [ ] WebSocket para atualização em tempo real

---

*GKHUB Platform – Desenvolvido para clubes profissionais de futsal e futebol.*
