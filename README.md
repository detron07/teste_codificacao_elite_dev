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
├── frontend/           # (etapa 5)
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

### Scripts úteis (back-end)

| Script | Descrição |
| --- | --- |
| `npm run start:dev` | API com hot reload |
| `npm test` | Testes unitários (Jest) |
| `npm run lint` | ESLint (regras type-aware) |
| `npm run typecheck` | Checagem de tipos |
| `npm run prisma:migrate` | Cria/aplica migração em desenvolvimento |
| `npm run db:reset` | Atenção: apaga o banco, reaplica migrações e roda o seed |

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
- [ ] **5. Front-end** — vitrine, sala ao vivo, painel do leiloeiro, carteira, auditoria, dark mode
- [ ] **6. Entrega** — Docker Compose completo, testes, deploy

## Uso de IA

*(Seção a ser detalhada ao final do projeto, conforme solicitado no enunciado.)*
