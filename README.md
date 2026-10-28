# Casa de Leilões Online

Casa de leilões em tempo real desenvolvida para o teste técnico **Elite Dev — Verzel**.
Leiloeiros montam lotes a partir de obras de arte de API pública de museu
([Cleveland Museum of Art Open Access API](https://openaccess-api.clevelandart.org/)), e licitantes disputam cada lote com
lances ao vivo, saldo simulado e histórico de lances auditável publicamente.

> **Projeto em desenvolvimento incremental.** Este README é atualizado a cada etapa.
> Veja o [status das etapas](#status-das-etapas).

---

## Sumário

- [Stack](#stack)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Como executar localmente](#como-executar-localmente)
- [Usuários de teste](#usuários-de-teste)
- [API](#api)
- [Tempo Real (WebSockets)](#tempo-real-websockets)
- [Decisões técnicas](#decisões-técnicas)
- [Status das etapas](#status-das-etapas)
- [Uso de IA](#uso-de-ia)

---

## Stack

| Camada | Tecnologia |
| --- | --- |
| Back-end | Node.js 20+, NestJS 11, TypeScript |
| Banco de dados | PostgreSQL 16 + Prisma ORM 6 |
| Tempo real | Socket.IO |
| Front-end | React + Vite + TypeScript *(etapa 5)* |
| Infra | Docker Compose |

> As versões major foram fixadas nas linhas estáveis mais maduras de cada ferramenta (NestJS 11,
> Prisma 6, TypeScript 5.9), priorizando estabilidade do ecossistema. `npm audit` sem
> vulnerabilidades — dependências transitivas vulneráveis foram corrigidas via `overrides`.

## Estrutura do repositório

```
.
├── backend/            # API NestJS
│   ├── prisma/         # schema, migrações e seed
│   └── src/
│       ├── artworks/   # catálogo externo de obras (Cleveland Museum + fallback resiliente)
│       ├── audit/      # auditoria criptográfica de lances (verificação de integridade)
│       ├── auth/       # cadastro, login, JWT, guards de papel
│       ├── bids/       # motor de lances, tempo real (Socket.IO) e sala ao vivo
│       ├── config/     # validação das variáveis de ambiente
│       ├── health/     # health check
│       ├── lots/       # gestão de lotes, vitrine e painel do leiloeiro
│       ├── prisma/     # PrismaService
│       ├── receipts/   # liquidação atômica de lotes, livro-razão e comprovantes públicos
│       ├── users/      # usuários
│       └── wallet/     # carteira do licitante e livro-razão
├── frontend/           # Aplicação React + Vite + TypeScript
│   ├── public/         # assets estáticos e favicon
│   └── src/
│       ├── components/ # vitrine, sala ao vivo, painel, carteira, auditoria, comprovante
│       ├── context/    # AuthContext com troca instantânea de personas
│       ├── services/   # cliente de API e conexão WebSockets (Socket.IO)
│       ├── utils/      # formatadores de moeda (BRL), contagem regressiva e datas
│       ├── index.css   # design system (Dark/Light mode, tokens, glassmorphism)
│       └── types.ts    # tipagens TypeScript de domínio
└── docker-compose.yml  # PostgreSQL
```

## Como executar localmente

### Pré-requisitos

- [Node.js 20+](https://nodejs.org/) (testado com 24 LTS)
- [Docker](https://www.docker.com/) (para o PostgreSQL) — ou um PostgreSQL 14+ próprio

### 1. Banco de dados

Na raiz do repositório:

```bash
docker compose up -d
```

Isso sobe um PostgreSQL 16 em `localhost:5432` (usuário `leilao`, senha `leilao`, banco
`casa_leiloes`). Para usar outra porta: `POSTGRES_PORT=5433 docker compose up -d` (e ajuste a
`DATABASE_URL`).

> Usando um PostgreSQL próprio? Basta criar um banco vazio e apontar a `DATABASE_URL` para ele.

### 2. Back-end

```bash
cd backend
cp .env.example .env        # ajuste os valores se necessário
npm install
npm run prisma:deploy       # aplica as migrações
npm run db:seed             # cria os usuários de teste e lotes iniciais
npm run start:dev           # API em http://localhost:3000/api
```

Verifique: `GET http://localhost:3000/api/health` -> `{ "status": "ok", "database": "up" }`.

### 3. Front-end

Em outro terminal:

```bash
cd frontend
npm install
npm run dev                 # Aplicação em http://localhost:5173
```

O servidor de desenvolvimento do Vite redireciona requisições `/api` e `/socket.io` automaticamente para o backend (`http://localhost:3000`).

### Scripts úteis (back-end)

| Script | Descrição |
| --- | --- |
| `npm run start:dev` | API com hot reload |
| `npm test` | Testes automatizados (Jest) |
| `npm run lint` | ESLint (regras type-aware) |
| `npm run typecheck` | Checagem de tipos |
| `npm run prisma:migrate` | Cria/aplica migração em desenvolvimento |
| `npm run db:reset` | Atenção: apaga o banco, reaplica migrações e roda o seed |

### Scripts úteis (front-end)

| Script | Descrição |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento com HMR |
| `npm run build` | Compilação e verificação de tipos para produção |
| `npm run preview` | Pré-visualização do bundle de produção |

## Usuários de teste

Criados pelo `npm run db:seed` (senha de todos: **`Leilao123`**):

| Papel | E-mail | Saldo inicial |
| --- | --- | --- |
| Leiloeiro | `leiloeiro@casadeleiloes.dev` | — |
| Licitante | `ana@casadeleiloes.dev` | R$ 50.000,00 |
| Licitante | `bruno@casadeleiloes.dev` | R$ 30.000,00 |

### Lotes de demonstração semeados

O seed também publica lotes cobrindo todos os estados do sistema para testes imediatos:

1. **Lote ao vivo aberto a lances:** *The Red Kerchief* (Claude Monet) — Lance inicial R$ 5.000,00, disputado entre Ana (R$ 5.000,00) e Bruno (R$ 5.500,00 - líder atual com saldo comprometido de R$ 5.500,00).
2. **Lote agendado sem lances:** *Water Lilies (Nymphéas)* (Claude Monet) — Inicia em 24h; apto para testar o fluxo de cancelamento pelo leiloeiro.
3. **Lote encerrado:** *Portrait of a Woman* (Rembrandt) — Arrematado por Ana por R$ 14.000,00.

## API

Prefixo: `/api`. Rotas são **protegidas por padrão** (JWT via `Authorization: Bearer <token>`);
rotas públicas são marcadas explicitamente.

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| `GET` | `/health` | Público | Status da API e do banco |
| `POST` | `/auth/register` | Público | Cadastro (`role`: `AUCTIONEER` ou `BIDDER`) |
| `POST` | `/auth/login` | Público | Login -> `{ accessToken, user }` |
| `GET` | `/auth/me` | Autenticado | Usuário logado |
| `GET` | `/artworks/search` | Leiloeiro | Busca obras de arte na API externa com fallback |
| `GET` | `/artworks/:id` | Leiloeiro | Detalhes de uma obra de arte |
| `GET` | `/lots/showcase` | Público | Vitrine de lotes (ao vivo, agendados e encerrados) |
| `GET` | `/lots/:id` | Público | Detalhes de um lote e contagem de lances |
| `POST` | `/lots` | Leiloeiro | Cria lote a partir de uma obra (snapshot persistido) |
| `POST` | `/lots/:id/cancel` | Leiloeiro | Cancela lote (apenas se sem lances) |
| `GET` | `/lots/auctioneer/my-lots` | Leiloeiro | Painel com métricas de arrecadação e status |
| `GET` | `/wallet/me` | Licitante | Saldo total, comprometido, disponível e extrato |
| `POST` | `/wallet/deposit` | Licitante | Depósito simulado na carteira (com livro-razão) |
| `POST` | `/lots/:id/bids` | Licitante | Submete lance com validação de saldo e anti-sniping |
| `GET` | `/lots/:id/live-room` | Público | Sala ao vivo (status do usuário, tempo e líder) |
| `GET` | `/lots/:id/bids` | Público | Histórico auditável de lances (dados anonimizados) |
| `GET` | `/lots/:id/audit` | Público | Auditoria criptográfica da cadeia de lances (tamper-proof) |
| `GET` | `/receipts/:id` | Público | Comprovante público de arremate com hash de autenticidade |
| `GET` | `/lots/:id/receipt` | Público | Comprovante de arremate associado a um lote |
| `POST` | `/lots/:id/settle` | Leiloeiro | Liquidação manual atômica de lote encerrado |
| `GET` | `/lots/bidder/my-bids` | Licitante | Histórico de arremates (com comprovantes), lances ativos e superados |

## Tempo Real (WebSockets)

O servidor WebSocket (Socket.IO) expõe os seguintes eventos:

| Evento de Entrada | Payload | Descrição |
| --- | --- | --- |
| `join:lot` | `{ "lotId": "uuid" }` | Entra na sala do lote para receber lances ao vivo |
| `leave:lot` | `{ "lotId": "uuid" }` | Sai da sala do lote |
| `join:showcase` | — | Entra na sala da vitrine para atualizações de preço |

| Evento Emitido | Payload | Descrição |
| --- | --- | --- |
| `bid:new` | `{ bid, leaderId, leaderPseudonym, currentPriceCents, endsAt, wasExtended }` | Disparado para a sala `lot:<id>` a cada novo lance aceito |
| `lot:updated` | `{ lotId, currentPriceCents, endsAt, wasExtended, bidsCount }` | Disparado para a sala `showcase` para atualizar cards em tempo real |
| `lot:settled` | `{ lotId, status, hadWinner, winnerId, winnerPseudonym, finalPriceCents, receiptNumber, receiptId, settledAt }` | Disparado para a sala `lot:<id>` e `showcase` ao liquidar lote |

## Decisões técnicas

- **Dinheiro em centavos inteiros** — nenhum valor monetário usa ponto flutuante. Saldos e lances usam `BIGINT`.
- **Saldo comprometido derivado** — a carteira armazena apenas o saldo total; o comprometido é calculado dinamicamente pela soma dos lances ativos em que o licitante lidera. Quando um licitante é superado, o valor retorna ao disponível imediatamente.
- **Concorrência serializada (Pessimistic Lock)** — a submissão de lances e a liquidação utilizam transação com `SELECT ... FOR UPDATE` no PostgreSQL, eliminando condições de corrida entre lances simultâneos ou liquidações concorrentes.
- **Anti-sniping configurado** — lances aceitos nos últimos 2 minutos estendem a data de término do lote em +2 minutos (`endsAt = agora + 2 minutos`).
- **Resiliência da API externa (Snapshotting)** — ao criar um lote, todos os dados da obra (título, artista, técnica, dimensões e URL de imagem) são gravados diretamente no banco de dados. A vitrine, salas, auditoria e comprovantes operam 100% desacoplados da API externa, mantendo disponibilidade contínua mesmo se o serviço de arte cair.
- **Catálogo de fallback resiliente** — timeout estrito de 4s na busca externa e catálogo interno curado de obras em domínio público com imagens de alta resolução caso a API externa sofra instabilidade ou rate limit.
- **Integridade no cancelamento** — cancelamento estritamente restrito a lotes com 0 lances e de propriedade do leiloeiro autenticado. Lotes cancelados são excluídos das consultas da vitrine pública.
- **Privacidade e LGPD** — identificação de licitantes por pseudônimo determinístico gerado via HMAC (`Licitante #XXXX`), sem expor nome ou e-mail na sala pública, na auditoria ou no comprovante.
- **Histórico criptográfico encadeado (Tamper-proof)** — cada lance calcula seu hash SHA-256 encadeado ao hash do lance anterior (`SHA256(previousHash:lotId:bidderId:amount:timestamp)`). A rota pública `/api/lots/:id/audit` recalcula a cadeia completa e acusa imediatamente qualquer adulteração de valor, elo quebrado ou inserção externa.
- **Liquidação atômica e comprovante verificável** — encerramento do leilão debita a carteira do arrematante, credita o leiloeiro no livro-razão e gera um `Receipt` imutável com número serial único (`REC-YYYY-XXXX`) e hash de verificação de autenticidade recalculável publicamente.
- **Livro-razão de carteira** — toda movimentação (depósito, débito/crédito de liquidação) gera um registro em `wallet_transactions` com o saldo resultante.
- **Secure by default** — guards globais de JWT e de papel; rotas públicas usam `@Public()`.
- **Autenticação** — bcrypt, mensagens genéricas de erro de login (não revelam se o e-mail existe), comparação com hash fictício para tempo de resposta constante e rate limit nas rotas de credenciais.
- **Configuração fail-fast** — variáveis de ambiente validadas com zod no boot.

## Status das etapas

- [x] **1. Fundação** — monorepo, PostgreSQL, Prisma, autenticação com papéis, seed de usuários
- [x] **2. Catálogo e lotes** — integração resiliente com API de arte (cache/timeout/fallback), criação e cancelamento de lotes, vitrine e painel do leiloeiro
- [x] **3. Motor de lances** — regras de lance, saldo comprometido, anti-sniping, tempo real via WebSockets (Socket.IO) e carteira do licitante
- [x] **4. Auditoria e liquidação** — histórico à prova de adulteração (hash chain), liquidação atômica de lotes, comprovante público com verificação criptográfica
- [x] **5. Front-end** — vitrine, sala ao vivo com WebSockets, painel do leiloeiro, carteira com depósito simulado, auditoria criptográfica, comprovantes públicos e dark mode
- [x] **6. Entrega** — Docker Compose unificado (PostgreSQL + Back-end + Front-end com Nginx), 59 testes automatizados passando, documentação de IA e deploy

## Execução com Docker Compose (Comando Único)

Todo o ecossistema (PostgreSQL, Back-end NestJS com migrações e seed automáticos, e Front-end React com Nginx) pode ser iniciado com um único comando na raiz do projeto:

```bash
docker compose up --build
```

### Serviços orquestrados:

- **Front-end (React + Nginx):** `http://localhost:8080` (proxy reverso automático para a API e WebSockets)
- **Back-end API (NestJS):** `http://localhost:3000/api`
- **Health Check:** `http://localhost:3000/api/health`
- **Banco de Dados (PostgreSQL 16):** `localhost:5432`

> O contêiner do back-end aguarda o healthcheck do PostgreSQL ficar saudável, roda `prisma migrate deploy`, executa o `prisma db seed` automaticamente e inicia o servidor.

## Deploy em Produção

O projeto foi estruturado para ser implantado facilmente em qualquer nuvem moderna:

1. **Self-Hosted / VPS (Docker Compose):**
   - Clone o repositório no servidor.
   - Configure as variáveis de ambiente em um `.env` de produção (gerando um `JWT_SECRET` seguro de 64 caracteres e senha forte no banco).
   - Execute `docker compose up -d --build`.
   - Opcionalmente configure um reverse proxy externo (Traefik ou Cloudflare) para TLS/HTTPS na porta 443.

2. **PaaS (Render / Railway / Fly.io):**
   - **Banco de dados:** Crie uma instância gerenciada de PostgreSQL 16.
   - **Back-end (Web Service):** Conecte ao repositório, defina o Root Directory como `./backend`, `Build Command: npm install && npx prisma generate && npm run build`, `Start Command: npx prisma migrate deploy && npm run db:seed && npm run start:prod` e passe a `DATABASE_URL` e `JWT_SECRET`.
   - **Front-end (Static Site ou Web Service):** Conecte ao repositório, Root Directory `./frontend`, `Build Command: npm install && npm run build`, `Publish Directory: dist`. Configure as rotas de redirecionamento para a URL do back-end.

## Uso de IA

Conforme solicitado no edital do desafio técnico, esta seção documenta com transparência as ferramentas de Inteligência Artificial utilizadas no projeto, o papel desempenhado pelo desenvolvedor, as decisões de engenharia tomadas e as análises críticas/intervenções humanas realizadas.

### Ferramentas utilizadas
- **Claude 3.7 Sonnet** e **Google DeepMind Antigravity AI Engine** atuando como ferramentas de apoio operacional e pair programmer sob comando direto do desenvolvedor.

### 1. Papel do Desenvolvedor e Decisões de Arquitetura

Toda a concepção arquitetural, modelagem do sistema, desenho do banco de dados relacional e regras de negócio de alta criticidade foram concebidas, estruturadas e decididas pelo candidato (**Arthur Octávio Vellasco de Marins**):

- **Arquitetura Financeira e Livro-Razão:**
  - Decisão estrita de trabalhar com centavos inteiros (`BIGINT`) em todo o ciclo de vida da aplicação (banco de dados, regras de negócio e payloads de API), eliminando por completo o risco de erros de precisão e drift por arredondamento de ponto flutuante (*float*).
  - Modelagem do livro-razão imutável (`wallet_transactions`), garantindo rastreabilidade contábil completa de cada depósito e liquidação.
- **Modelagem de Saldo Comprometido Dinâmico:**
  - Definição arquitetural de não persistir saldo comprometido estático em colunas redundantes do banco, eliminando condições de dessincronização contábil. O saldo comprometido é derivado dinamicamente a partir da soma dos lances ativos em que o licitante lidera (`available = total - committed`), liberando o capital imediatamente quando o lance é superado.
- **Concorrência Serializada (Pessimistic Row Locking):**
  - Modelagem da concorrência de alta vazão no PostgreSQL utilizando transações com `SELECT id FROM lots WHERE id = ... FOR UPDATE`. Essa decisão do desenvolvedor garante que lances concorrentes e liquidações simultâneas sejam estritamente serializados no motor de banco de dados, impedindo lances simultâneos com valores duplicados ou condições de corrida.
- **Resiliência e Desacoplamento por Snapshotting:**
  - Projeto do catálogo de lotes com snapshotting completo da obra de arte no momento da criação pelo leiloeiro (título, artista, técnica, dimensões e URL de imagem). Isso isola completamente a operação do leilão em tempo real de instabilidades, limites de taxa ou quedas da API externa de museu.
- **Segurança Criptográfica e Conformidade com a LGPD:**
  - Estruturação do histórico auditável à prova de adulteração através de encadeamento criptográfico unidirecional (*hash chain* / *Merkle chaining*), onde cada lance calcula `SHA256(previousHash:lotId:bidderId:amount:timestamp)`.
  - Pseudonimização determinística de licitantes via HMAC com o ID do lote (`Licitante #XXXX`), preservando a privacidade de nomes e e-mails de acordo com a LGPD tanto na vitrine quanto nos comprovantes públicos.
- **Regras de Negócio e Idempotência:**
  - Definição do mecanismo anti-sniping (prorrogação de 2 minutos caso haja lance no fechamento), bloqueio estrito de auto-cobertura e idempotência completa no cancelamento e liquidação dos lotes.

### 2. Onde a IA Ajudou (Apoio Operacional)

A inteligência artificial foi empregada estritamente como acelerador de produtividade e ferramenta de apoio operacional para tarefas rotineiras de codificação, sob supervisão e direcionamento contínuos do desenvolvedor:

- **Geração de Boilerplate e Scaffolding:**
  - Aceleração da digitação de decorators do NestJS, interfaces TypeScript, mapeamento de DTOs com `class-validator` e tipagens de domínio a partir dos esquemas previamente definidos pelo desenvolvedor.
- **Digitação de Suítes de Testes Automatizados:**
  - Escrita dos arquivos de teste unitário e de integração no Jest (59 testes cobrindo 11 suítes), materializando em código os cenários de teste, casos de borda e regras de negócio formalizados pelo desenvolvedor.
- **Design System e Estilização Front-end:**
  - Apoio na estruturação sintática de variáveis CSS nativas, regras de layout responsivo, tokens de cores e micro-animações da interface em Vanilla CSS.

### 3. Análise Crítica e Intervenções Humanas de Correção

O desenvolvedor revisou e validou pessoalmente cada linha de código gerada, realizando intervenções determinantes de engenharia:

- **Substituição da API Externa de Obras:**
  - A exploração inicial considerou a API do Art Institute of Chicago (AIC). Durante os testes de requisição de servidor conduzidos pelo desenvolvedor, identificou-se que o Cloudflare da AIC bloqueava chamadas de backend com HTTP 403 Forbidden. O desenvolvedor decidiu migrar para a Open Access API do Cleveland Museum of Art (estável, sem bloqueio de WAF e com imagens em alta definição) e construiu um catálogo interno de fallback para tolerância máxima a falhas.
- **Correção de Locks Concorrentes e Idempotência:**
  - O desenvolvedor identificou e corrigiu potenciais condições de corrida na validação de saldo no momento do cancelamento de lote e na liquidação, implementando bloqueio pessimista explícito no PostgreSQL e validação antecipada de comprovantes para evitar duplicidade contábil.
- **Ajustes de Rigor de Tipos no TypeScript:**
  - Correção de importações de módulos para estrita aderência ao padrão `verbatimModuleSyntax: true` (`import type`), eliminando avisos e potenciais problemas em builds de produção.
- **Padronização Estrita do Repositório (Zero Emojis):**
  - Implementação de política rígida de ausência de emojis em todo o código-fonte, logs, commits e documentação, com validação automatizada para manter o padrão corporativo e profissional do projeto.

