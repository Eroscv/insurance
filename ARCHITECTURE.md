# ARCHITECTURE

## Visão geral

Monorepo npm workspaces com dois apps e dois pacotes:

```
apps/web        Next.js 15 (App Router) — UI
apps/api        NestJS 11 — API REST /api/v1
packages/shared Enums, zod schemas, máquina de estados, cálculos, permissões, formatters
packages/database Prisma schema, migrations, seed, client tipado
```

Infra local via `docker-compose.yml`: PostgreSQL 16, MinIO (S3), api, web.

```
Browser ──(cookies httpOnly)──▶ apps/web (Next) ──▶ apps/api (Nest) ──▶ PostgreSQL
                                                          │
                                                          ├──▶ MinIO/S3 (documentos, PDFs)
                                                          └──▶ Puppeteer (HTML → PDF)
```

## Princípios

1. **Zero IA.** Nenhuma dependência de LLM/ML. Toda decisão é regra explícita, testável.
2. **Tenant por construção.** O filtro `organizationId` é injetado pelo Prisma Client Extension a partir do `TenantContext`; services nunca o passam manualmente.
3. **Regras puras no `shared`.** Máquina de estados, cálculos e validadores não conhecem banco nem HTTP; são reutilizados pelo front (ex.: Kanban decide se pode arrastar) e pelo back (fonte da verdade).
4. **Módulos por domínio.** Cada módulo em `apps/api/src/modules/<dominio>` tem controller, service, repository, dto (zod), spec.
5. **Entrada manual sempre disponível.** Nenhuma integração fictícia; onde não há integração, há formulário.

## Backend (apps/api)

```
src/
  main.ts                 bootstrap: helmet, cors, cookies, prefix /api/v1, zod filter
  app.module.ts
  config/                 env.schema.ts (zod) + ConfigModule
  common/
    tenant/               tenant-context.ts (AsyncLocalStorage), tenant.guard.ts
    auth/                 jwt-auth.guard.ts, roles.guard.ts, decorators (CurrentUser, Roles, Public)
    validation/           zod-validation.pipe.ts
    filters/              http-exception.filter.ts, prisma-exception.filter.ts
    pagination/           pagination.dto.ts, paginate.ts
    interceptors/         logging
  infra/
    prisma/               prisma.service.ts (client estendido com tenant + soft delete), prisma.module.ts
    storage/              storage.service.ts (S3), storage.module.ts
    pdf/                  pdf.service.ts (Puppeteer + Handlebars)
    mailer/               mailer.service.ts (stub: loga)
    scheduler/            jobs: stale-quotes, expiring-proposals, overdue-tasks
  modules/
    auth/ organizations/ users/ clients/ vehicles/ documents/ quotes/ insurers/
    quote-insurers/ proposals/ comparison/ tasks/ notifications/ audit/ dashboard/ health/
templates/proposal/       proposal.hbs + proposal.css
test/                     setup de integração (banco insurance_test), tenant-isolation.spec.ts
```

### Request lifecycle

1. `JwtAuthGuard` lê cookie `access_token`, valida, carrega `{ userId, organizationId, role }`.
2. `TenantContext.run(ctx)` envolve o restante do pipeline (AsyncLocalStorage).
3. `RolesGuard` verifica `@Roles()` contra a matriz em `packages/shared/src/permissions`.
4. `ZodValidationPipe` valida body/query com o schema do DTO.
5. Service → Repository → `PrismaService` (extensão injeta `organizationId` e `deletedAt: null`).
6. `AuditService.record()` nas mutações relevantes.
7. Filters normalizam erros (`{ statusCode, error, message, details }`).

### Prisma Client Extension (tenant + soft delete)

- Models tenantizados: users, clients, vehicles, documents, quotes, quote_auto_details (via quote), quote_status_history, insurers, quote_insurers, proposals, tasks, notifications, audit_logs, organization_settings.
- Para operações de leitura/escrita: `where = { ...where, organizationId: ctx.organizationId }`; para `create`: `data.organizationId = ctx.organizationId`.
- Soft delete: models com `deletedAt` recebem `deletedAt: null` nas leituras, salvo `includeDeleted: true` explícito.
- Fora de request (crons/seed): `prisma.forOrganization(orgId)` cria um contexto explícito; `prisma.system` é o client cru, restrito a `infra/` e `auth`.

## Frontend (apps/web)

```
src/
  app/
    (auth)/login, forgot-password, reset-password
    (app)/layout.tsx        sidebar + topbar + notificações
    (app)/dashboard, clients, clients/[id], quotes, quotes/new, quotes/[id], quotes/kanban,
          insurers, tasks, documents, settings/{organization,users,profile}
  components/ui/            shadcn (button, input, table, dialog, sheet, tabs, toast, skeleton, badge, select, ...)
  components/domain/        ClientForm, VehicleForm, DocumentUploader, DocumentViewer, QuoteWizard,
                            QuoteStatusBadge, Kanban, ProposalForm, ComparisonTable, TaskList, ...
  lib/api-client.ts         fetch + credentials + refresh automático
  lib/queries/              hooks TanStack Query por domínio
  lib/formatters.ts         CPF/CNPJ/telefone/CEP/BRL/datas
  middleware.ts             redireciona para /login sem cookie
```

Estado de servidor: TanStack Query. Formulários: react-hook-form + zod (schemas de `shared`). Tabelas: TanStack Table (paginação server-side). Kanban: dnd-kit. Gráfico: Recharts. Toasts: sonner.

## Pacotes

### packages/shared
```
src/enums.ts              espelha os enums Prisma (fonte única para o front)
src/schemas/              zod por domínio (client, vehicle, quote, proposal, task, user, auth, ...)
src/quotes/status-machine.ts
src/calculations/         difference, percentageDifference, installmentTotal, commission, highlightBest, comparisonMatrix
src/permissions.ts        matriz role × ação
src/validators/           cpf, cnpj, plate, cep
src/formatters/           mask/unmask
src/labels.ts             rótulos pt-BR dos enums
```

### packages/database
```
prisma/schema.prisma
prisma/migrations/
prisma/seed.ts
src/index.ts              re-export do PrismaClient e tipos
```

## Jobs

`@nestjs/schedule` in-process. Interface `JobRunner` (`run(name, fn)`) encapsula execução e log; trocar por BullMQ no futuro sem alterar os jobs.

## Segurança

Ver `IMPLEMENTATION_PLAN.md` §B13.

## Extensão futura

- Novo tipo de seguro: enum `InsuranceType` + tabela `quote_<tipo>_details` + schema zod + step do wizard.
- Integração com seguradora: interface `InsurerGateway { requestQuote(quoteInsurer) }` em `modules/quote-insurers/gateways/`; sem implementação no MVP.
- Importação de planilhas: módulo `imports` com tabela `import_jobs` (status por etapa) — não criado no MVP.
- E-mail: substituir `MailerService` stub por SMTP.
- WhatsApp: hoje apenas "Copiar mensagem" (template de texto).
