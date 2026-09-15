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
npm install
docker compose up -d postgres minio
npm run db:migrate
npm run db:seed
npm run dev
```

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
npm test               # unit + integração (requer postgres do compose)
npm run test:e2e       # Playwright (requer api + web rodando)
npm run lint
npm run typecheck
```

## Estrutura

```
apps/api         NestJS — módulos por domínio
apps/web         Next.js — App Router
packages/shared  enums, schemas zod, máquina de estados, cálculos, permissões
packages/database Prisma schema, migrations, seed
```

Documentação: `IMPLEMENTATION_PLAN.md` (PRD + spec), `ARCHITECTURE.md`, `DATABASE.md`, `BUSINESS_RULES.md`.
