# Insurance — Gestão e Cotação para Corretoras de Seguros

SaaS B2B que centraliza a operação de cotação de seguros: cliente → documentos → cotação → seguradoras → propostas → comparativo → proposta comercial → follow-up → fechamento.

**Sem IA.** Todo o sistema é determinístico (CRUD, regras, cálculos, templates, cron).

## Stack

| Camada | Tecnologia |
|---|---|
| Web | Next.js 15, React 19, TypeScript, Tailwind CSS 4, shadcn/ui |
| API | NestJS 11, TypeScript, zod |
| Banco | PostgreSQL 16, Prisma 6 |
| Storage | S3-compatible (MinIO em dev) |
| PDF | Puppeteer (HTML/CSS → PDF) |
| Jobs | @nestjs/schedule |
| Testes | Vitest, Playwright |
| Infra | Docker, Docker Compose, npm workspaces |

## Requisitos

- Node.js ≥ 24, npm ≥ 11
- Docker + Docker Compose v2+

## Instalação

```bash
git clone <repo> insurance && cd insurance
cp .env.example .env
npm install            # gera o Prisma Client e compila packages/*
docker compose up -d postgres minio minio-init
npm run db:migrate
npm run db:seed
npm run dev
```

> npm ≥ 11 bloqueia scripts de instalação por padrão. Se o Prisma Client, `argon2` ou `@swc/core` não forem compilados, execute:
> `npm approve-scripts @prisma/client @prisma/engines @swc/core argon2 esbuild prisma puppeteer unrs-resolver && npm rebuild`.

Portas padrão: web 3000 · API 3001 · Postgres **5433** (host) · MinIO 9000/9001.

- Web: http://localhost:3000
- API: http://localhost:3001/api/v1 (health em `/api/v1/health`)
- MinIO console: http://localhost:9001

Usuários do seed (senha `Demo@12345`): `admin@demo.local`, `gestor@demo.local`, `corretor@demo.local`.

## Variáveis de ambiente

Ver `.env.example`. Principais: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `S3_*`, `WEB_URL`, `API_URL`, `NEXT_PUBLIC_API_URL`, `MAX_UPLOAD_MB`.

## Banco de dados

```bash
npm run db:migrate    # cria/aplica migrations (dev)
npm run db:deploy     # aplica migrations (prod/CI)
npm run db:seed       # dados fictícios (idempotente)
npm run db:studio     # Prisma Studio
```

Modelo: `DATABASE.md`.

## Executar

```bash
npm run dev            # api + web em paralelo
npm run dev:api
npm run dev:web
docker compose up      # stack completa em containers
```

## Testar

```bash
npm test               # unit (packages/shared) + integração da API (requer postgres do compose; usa o banco insurance_test)
npm run test:e2e       # Playwright — fluxo completo do MVP; requer `npm run dev` ativo (api + web)
npm run lint
npm run typecheck
```

A suíte de integração aplica as migrations no banco `insurance_test` (criado pelo `docker/postgres-init.sql`) e limpa as tabelas entre os testes. Os testes de upload e PDF usam o MinIO e o Chromium do Puppeteer reais.

## Docker (stack completa)

```bash
docker compose --profile full up --build
```

A imagem da API instala o Chromium do sistema (`PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`) e aplica as migrations no start.

## Estrutura

```
apps/api         NestJS — módulos por domínio (auth, users, organizations, clients, vehicles, documents,
                 quotes, insurers, quote-insurers, proposals, comparison, proposal-pdf, tasks,
                 notifications, dashboard, audit) + infra (prisma, storage, pdf, mailer, scheduler)
apps/web         Next.js — App Router, TanStack Query, react-hook-form + zod, shadcn-style UI
packages/shared  enums, labels pt-BR, schemas zod, máquina de estados, cálculos, permissões, formatters
packages/database Prisma schema, migrations, seed
```

## Automações (cron, sem IA)

| Job | Horário | Efeito |
|---|---|---|
| Cotação parada | 07:00 | notificação para o responsável (dias configuráveis por organização) |
| Proposta vencendo | 07:05 | tarefa + notificação 3 dias antes; vencidas viram `EXPIRED` |
| Tarefa atrasada | a cada hora | notificação ao dono (1×/dia) |

Documentos pendentes são calculados em tempo real no dashboard.

Documentação: `IMPLEMENTATION_PLAN.md` (PRD + spec), `ARCHITECTURE.md`, `DATABASE.md`, `BUSINESS_RULES.md`.
