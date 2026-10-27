# Casa de Leilões Online

Casa de leilões em tempo real desenvolvida para o teste técnico **Elite Dev — Verzel**.
Leiloeiros montam lotes a partir de obras de arte da API pública do
[Art Institute of Chicago](https://api.artic.edu/docs/), e licitantes disputam cada lote com
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
- [Decisões técnicas](#decisões-técnicas)
- [Status das etapas](#status-das-etapas)
- [Uso de IA](#uso-de-ia)

---

## Stack

| Camada | Tecnologia |
| --- | --- |
| Back-end | Node.js 20+, NestJS 11, TypeScript |
| Banco de dados | PostgreSQL 16 + Prisma ORM 6 |
| Tempo real | Socket.IO *(etapa 3)* |
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
│       ├── auth/       # cadastro, login, JWT, guards de papel
│       ├── config/     # validação das variáveis de ambiente
│       ├── health/     # health check
│       ├── prisma/     # PrismaService
│       └── users/
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
npm run db:seed             # cria os usuários de teste
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

## API

Prefixo: `/api`. Rotas são **protegidas por padrão** (JWT via `Authorization: Bearer <token>`);
rotas públicas são marcadas explicitamente.

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| `GET` | `/health` | Público | Status da API e do banco |
| `POST` | `/auth/register` | Público | Cadastro (`role`: `AUCTIONEER` ou `BIDDER`) |
| `POST` | `/auth/login` | Público | Login -> `{ accessToken, user }` |
| `GET` | `/auth/me` | Autenticado | Usuário logado |

## Decisões técnicas

- **Dinheiro em centavos inteiros** — nenhum valor monetário usa ponto flutuante. Saldos de
  carteira usam `BIGINT`.
- **Saldo comprometido derivado** — a carteira armazena apenas o saldo total; o comprometido é
  calculado a partir dos lotes abertos em que o licitante lidera. Uma única fonte de verdade
  elimina divergências entre "saldo" e "reservas".
- **Livro-razão de carteira** — toda movimentação (depósito, débito/crédito de liquidação) gera um
  registro em `wallet_transactions` com o saldo resultante.
- **Secure by default** — guards globais de JWT e de papel; rotas públicas usam `@Public()`.
- **Autenticação** — bcrypt, mensagens genéricas de erro de login (não revelam se o e-mail
  existe), comparação com hash fictício para tempo de resposta constante e rate limit nas rotas
  de credenciais.
- **Configuração fail-fast** — variáveis de ambiente validadas com zod no boot.

*(As decisões de lances, anti-sniping, resiliência da API externa e auditoria à prova de
adulteração serão documentadas nas próximas etapas.)*

## Status das etapas

- [x] **1. Fundação** — monorepo, PostgreSQL, Prisma, autenticação com papéis, seed de usuários
- [ ] **2. Catálogo e lotes** — integração com a API do AIC (cache/fallback), criação e
      cancelamento de lotes, vitrine
- [ ] **3. Motor de lances** — regras de lance, saldo comprometido, anti-sniping, tempo real
- [ ] **4. Auditoria e liquidação** — histórico à prova de adulteração, liquidação, comprovante
- [ ] **5. Front-end** — vitrine, sala ao vivo, painel do leiloeiro, carteira, auditoria, dark mode
- [ ] **6. Entrega** — Docker Compose completo, testes, deploy

## Uso de IA

*(Seção a ser detalhada ao final do projeto, conforme solicitado no enunciado.)*
