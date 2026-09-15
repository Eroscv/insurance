# IMPLEMENTATION_PLAN — SaaS de Gestão e Cotação para Corretoras de Seguros

> Documento único: **PRD** (Parte A) + **Especificação Técnica** (Parte B) + **Plano de Execução** (Parte C).
> Regra inegociável: **ZERO IA**. Nenhum LLM, ML, OCR por modelo, classificação ou geração automática por IA. Tudo é determinístico.

---

# PARTE A — PRD

## A1. Visão do produto

Plataforma SaaS B2B para corretoras, corretores e assessorias de seguros que centraliza o processo de cotação, substituindo WhatsApp, planilhas, e-mails, PDFs soltos e anotações.

Fluxo central:

`Cliente → Documentos → Cotação → Seguradoras → Propostas → Comparativo → Proposta comercial → Follow-up → Fechamento`

Posicionamento: **"Centralizar toda a operação de cotação de seguros em um único lugar."** Não é "mais um CRM".

## A2. Objetivo principal

O corretor conclui uma cotação inteira **sem repetir informação**: cliente cadastrado uma vez, reutilizado em todas as cotações; propostas registradas manualmente e comparadas automaticamente por regras matemáticas; proposta comercial gerada a partir de template; follow-up e fechamento rastreados.

## A3. Público-alvo e escopo

- Corretores autônomos, corretoras pequenas e médias, assessorias, equipes comerciais.
- **Foco inicial: Seguro Auto.** Arquitetura preparada para Residencial, Empresarial, Vida, Viagem, Equipamentos, Condomínio, Celular (tabelas de detalhe por tipo).
- Sem integrações externas com seguradoras no MVP. Entrada manual sempre que uma integração não existir. **Não criar APIs fictícias.**

## A4. Escopo do MVP

1. Autenticação (login, logout, refresh, esqueci senha)
2. Dashboard
3. Clientes
4. Documentos (upload, visualização, status)
5. Cotações (CRUD, status, filtros)
6. Formulário de cotação (wizard 5 etapas)
7. Seguradoras
8. Consultas (cotação × seguradora)
9. Propostas (com coberturas e assistências)
10. Comparativo
11. Pipeline (Kanban)
12. Tarefas
13. Histórico (auditoria + mudanças de status)
14. Geração de proposta comercial em PDF
15. Configurações básicas (organização, usuários, perfil)

**Fora do MVP (arquitetura preparada, não implementado):** WhatsApp Business API, e-mail transacional real, APIs de seguradoras, importação de Excel, webhooks de saída, gateway de pagamento, portal do cliente.

## A5. Perfis (RBAC)

| Role | Pode |
|---|---|
| ADMIN | Tudo, incluindo configurações da organização, usuários e seguradoras |
| MANAGER | Tudo operacional em toda a organização; reatribuir cotações; ver todos os corretores; sem gerenciar usuários/organização |
| BROKER | Operar clientes, cotações, propostas e tarefas; vê todas as cotações da organização, mas só edita as atribuídas a si ou sem responsável |

## A6. Telas

- **Login**: logo, e-mail, senha, entrar, esqueci minha senha.
- **Layout**: sidebar (Dashboard, Clientes, Cotações, Seguradoras, Tarefas, Documentos, Configurações) + sino de notificações + menu do usuário.
- **Dashboard**: cards (abertas, aguardando documentos, propostas recebidas, propostas enviadas, fechadas, perdidas), gráfico de cotações por status, atividades recentes, alertas (documentos pendentes, cotações paradas, tarefas atrasadas).
- **Clientes**: tabela (Cliente, CPF/CNPJ, Telefone, Cotações, Última cotação, Ações), busca, filtros, criar/editar/visualizar.
- **Detalhe do cliente**: header (nome, documento, telefone, WhatsApp), tabs Dados / Cotações / Documentos / Veículos / Histórico, botão "Nova cotação".
- **Nova cotação (wizard)**: 1 Cliente (existente/novo) → 2 Tipo de seguro → 3 Dados (veículo + detalhes auto) → 4 Documentos → 5 Seguradoras.
- **Detalhe da cotação**: header (número, cliente, status, corretor), abas Visão geral / Dados / Documentos / Seguradoras / Propostas / Comparativo / Tarefas / Histórico.
- **Kanban**: colunas por status, drag-and-drop, registro de histórico a cada movimento, validação de regras ao mover.
- **Comparativo**: matriz propostas × atributos (prêmio, franquia, parcelas, coberturas, assistências) com destaques de menor preço e menor franquia.
- **Tarefas**: lista com filtros, atrasadas destacadas, utilizável no celular.
- **Configurações**: organização (dados, logo, % comissão padrão, dias para "parada", documentos obrigatórios), usuários, perfil.

## A7. Regras de negócio

Ver `BUSINESS_RULES.md` (fonte canônica). Resumo:

- CPF/CNPJ não duplica dentro da organização.
- Toda cotação tem cliente.
- "Dados completos" só sem documentos obrigatórios pendentes.
- Proposta sempre vinculada a uma consulta de seguradora.
- "Proposta enviada" exige ≥ 1 proposta cadastrada.
- "Fechada (WON)" exige proposta selecionada.
- "Perdida" exige motivo (Preço, Cliente desistiu, Concorrente, Recusa da seguradora, Sem retorno, Outro).
- Destaques do comparativo por regra matemática simples.

## A8. Automações tradicionais (cron)

- Cotação parada X dias → notificação.
- Proposta vencendo em 3 dias → tarefa + notificação; vencida → EXPIRED.
- Tarefa vencida → visual de atrasada + notificação.
- Documento pendente → alerta no dashboard (consulta em tempo real).

## A9. Notificações internas

Tipos: NEW_TASK, TASK_OVERDUE, DOCUMENT_RECEIVED, DOCUMENT_PENDING, PROPOSAL_RECEIVED, PROPOSAL_EXPIRING, STALE_QUOTE.

## A10. Critérios de aceite do MVP

Um usuário consegue: criar conta → criar organização → criar usuários → criar cliente → adicionar veículo → upload de documentos → criar cotação → preencher dados do seguro → adicionar seguradoras → registrar propostas → comparar → selecionar proposta → gerar proposta comercial (PDF) → criar follow-up → alterar status → fechar cotação → consultar histórico completo.

## A11. Princípio final

Toda funcionalidade deve responder "isso reduz trabalho, reduz erro ou economiza tempo do corretor?". Se não, fica para depois. Não usar IA. Não inventar integrações. Não inventar dados. Simples, rápido, confiável.

---

# PARTE B — ESPECIFICAÇÃO TÉCNICA

## B1. Análise do repositório

Repositório inicialmente **vazio** (sem código, sem git). Ambiente: Node 24.18, npm 11.16, Docker 29 + Compose 5.5, git 2.55. Sem stack prévia → stack do PRD adotada integralmente.

## B2. Stack e decisões

| Tema | Decisão | Justificativa |
|---|---|---|
| Monorepo | npm workspaces | npm já presente; sem ferramenta extra |
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind 4, shadcn/ui | Stack do PRD; componentes acessíveis prontos |
| Backend | NestJS 11, TypeScript | Módulos por domínio |
| Banco | PostgreSQL 16, Prisma 6 | Schema único em `packages/database` |
| Auth | JWT em cookie httpOnly SameSite=Lax; access 15 min, refresh 7 d rotativo em tabela `sessions` | Revogável, CSRF mitigado |
| Multi-tenant | `organizationId` em toda tabela operacional + `TenantContext` (AsyncLocalStorage) + Prisma Client Extension que injeta o filtro | Impossível esquecer o tenant no service |
| RBAC | Guard `@Roles()` + matriz de permissões em `packages/shared` | Testável |
| Storage | S3-compatible (`@aws-sdk/client-s3`), MinIO no compose | Arquivos privados, URL pré-assinada 60 s |
| PDF | Puppeteer + template Handlebars (HTML/CSS) | Exigência do PRD |
| Jobs | `@nestjs/schedule` (cron in-process); BullMQ/Redis fora do MVP, atrás de interface `JobRunner` | Cargas leves |
| Validação | zod compartilhado (web + api) | Sem duplicação |
| Testes | Vitest (unit/integração), Playwright (E2E) | |
| Valores monetários | `Decimal(12,2)` no banco, `decimal.js` nos cálculos | Nunca float |
| Soft delete | `deletedAt` em clients, vehicles, documents, quotes, insurers | |
| Idioma | UI pt-BR; código em inglês | |

## B3. Estrutura

```
apps/api            NestJS (src/common, src/infra, src/modules/<dominio>, templates/, test/)
apps/web            Next.js (src/app/(auth), src/app/(app)/..., src/components/{ui,domain}, src/lib, e2e/)
packages/database   Prisma schema, migrations, seed, client
packages/shared     enums, zod schemas, status-machine, calculations, permissions, formatters, types
docker-compose.yml  postgres, minio, api, web
```

Cada módulo da API: `controller`, `service`, `repository`, `dto/` (zod), `*.spec.ts`.

## B4. Modelo de dados

Convenções: `id` UUID; `created_at`/`updated_at` em todas; `organization_id` em todas as tabelas operacionais (exceto `organizations`); enums Postgres nativos; dinheiro `Decimal(12,2)`.

### Tabelas do PRD (todas mantidas) + campos adicionais

| Tabela | Observações / adições |
|---|---|
| organizations | + `settings` via tabela própria |
| organization_settings | `organization_id` PK, `commission_percentage` Decimal(5,2) default 10, `stale_quote_days` int default 5, `required_document_types` DocumentType[] default [CNH, CRLV], `proposal_footer_text`, `proposal_validity_days` default 7 |
| organization_quote_counters | `organization_id` PK, `last_number` int — numeração sequencial por org |
| users | `role` enum, `active` bool, `deleted_at` |
| sessions | `id`, `user_id`, `token_hash`, `user_agent`, `ip`, `expires_at`, `revoked_at` |
| password_resets | `id`, `user_id`, `token_hash`, `expires_at`, `used_at` |
| clients | PRD + `deleted_at`; UNIQUE parcial `(organization_id, document) WHERE deleted_at IS NULL`; índices em phone, email |
| vehicles | PRD + `organization_id`, `deleted_at` |
| documents | PRD + `storage_key` (chave S3; `file_url` não persiste — é gerado sob demanda), `deleted_at` |
| quotes | PRD + `quote_number` int (único por org), `insurance_type` enum, `priority` enum, `deleted_at`, `last_activity_at` |
| quote_auto_details | PRD, `desired_coverage` text |
| quote_status_history | `id`, `quote_id`, `from_status`, `to_status`, `user_id`, `reason`, `created_at` |
| insurers | PRD + `deleted_at` |
| quote_insurers | PRD; UNIQUE `(quote_id, insurer_id)` |
| proposals | PRD + `organization_id`, `storage_key`, `commission_percentage` Decimal(5,2) nullable |
| proposal_coverages | PRD; `insured_amount` Decimal(12,2) nullable |
| proposal_assistances | PRD |
| tasks | PRD; índice `(organization_id, status, due_date)` |
| notifications | `id`, `organization_id`, `user_id`, `type`, `title`, `body`, `entity`, `entity_id`, `read_at`, `created_at`; UNIQUE parcial para idempotência de crons `(organization_id, type, entity, entity_id, dedupe_key)` |
| audit_logs | PRD; `old_data`/`new_data` JSONB; índice `(organization_id, entity, entity_id)` |

### Enums

- `Role`: ADMIN, MANAGER, BROKER
- `ClientType`: INDIVIDUAL, COMPANY
- `MaritalStatus`: SINGLE, MARRIED, DIVORCED, WIDOWED, STABLE_UNION
- `Fuel`: GASOLINE, ETHANOL, FLEX, DIESEL, ELECTRIC, HYBRID, GNV
- `DocumentType`: CNH, CRLV, ID, ADDRESS_PROOF, PROPOSAL, OTHER
- `DocumentStatus`: PENDING, RECEIVED, VALIDATED, REJECTED
- `InsuranceType`: AUTO (futuro: HOME, BUSINESS, LIFE, TRAVEL, EQUIPMENT, CONDO, MOBILE)
- `QuoteStatus`: NEW, WAITING_DOCUMENTS, DATA_COMPLETE, QUOTING, WAITING_PROPOSALS, PROPOSALS_RECEIVED, PROPOSAL_SENT, NEGOTIATION, WON, LOST, CANCELLED
- `Priority`: LOW, MEDIUM, HIGH
- `LostReason`: PRICE, CLIENT_GAVE_UP, COMPETITOR, INSURER_REFUSED, NO_RESPONSE, OTHER
- `QuoteInsurerStatus`: NOT_STARTED, REQUESTED, WAITING, RECEIVED, REFUSED, NO_RESPONSE, CANCELLED
- `ProposalStatus`: RECEIVED, SELECTED, REJECTED, EXPIRED
- `DeductibleType`: STANDARD, REDUCED, INCREASED, NONE
- `TaskStatus`: TODO, IN_PROGRESS, DONE, CANCELLED
- `NotificationType`: NEW_TASK, TASK_OVERDUE, DOCUMENT_RECEIVED, DOCUMENT_PENDING, PROPOSAL_RECEIVED, PROPOSAL_EXPIRING, STALE_QUOTE
- `AuditAction`: CREATE, UPDATE, DELETE, STATUS_CHANGE, UPLOAD, SEND, SELECT_PROPOSAL, LOGIN

Detalhamento coluna a coluna: `DATABASE.md` e `packages/database/prisma/schema.prisma`.

## B5. Multi-tenancy (regra crítica)

1. `JwtAuthGuard` valida o cookie e popula `TenantContext.run({ organizationId, userId, role }, next)`.
2. `PrismaService` exporta o client **estendido**: para todo model com `organizationId`, `findMany/findFirst/findUnique/update/updateMany/delete/deleteMany/count/aggregate` recebem `where.organizationId = ctx.organizationId` e `create/createMany` recebem `data.organizationId`.
3. Chamadas fora de contexto (crons) usam `prisma.forOrganization(orgId)` explicitamente ou `prisma.system` (apenas infra) — nunca o client bruto nos módulos.
4. Teste de integração `tenant-isolation.spec.ts`: cria 2 orgs, insere dados em cada, prova que cada endpoint de listagem/detalhe nunca retorna o registro da outra org (404, não 403, para não vazar existência).

## B6. Autenticação e sessão

- `POST /auth/register` — cria organization + settings + counter + user ADMIN (transação).
- `POST /auth/login` — argon2 verify; emite access (JWT 15 min, cookie `access_token`) + refresh (opaco 7 d, hash em `sessions`, cookie `refresh_token`, path `/auth/refresh`).
- `POST /auth/refresh` — rotação: revoga o anterior, emite novo par.
- `POST /auth/logout` — revoga sessão.
- `POST /auth/forgot-password` — gera token (hash em `password_resets`, 1 h). Envio: `MailerService` stub que loga o link (sem SMTP no MVP). Resposta sempre 200.
- `POST /auth/reset-password`.
- `GET /auth/me`.
- Cookies: `httpOnly`, `secure` em produção, `SameSite=Lax`. Origin check em mutações (`Origin`/`Referer` ∈ `WEB_URL`).

## B7. Contratos de API (prefixo `/api/v1`)

Padrão de listagem: `?page=1&pageSize=20&search=&sort=field:asc&<filtros>` → `{ data, meta: { page, pageSize, total } }`.
Erros: `{ statusCode, error, message, details? }` (details = issues zod).

| Módulo | Endpoints |
|---|---|
| organizations | `GET/PATCH /organizations/current`, `PATCH /organizations/current/settings`, `POST /organizations/current/logo` |
| users | `GET /users`, `POST /users` (ADMIN), `PATCH /users/:id`, `PATCH /users/:id/active`, `PATCH /users/me`, `PATCH /users/me/password` |
| clients | `GET /clients` (search por nome/documento/telefone/email; filtros type, city), `POST`, `GET /:id`, `PATCH /:id`, `DELETE /:id` (soft), `GET /:id/quotes`, `GET /:id/documents`, `GET /:id/vehicles`, `GET /:id/history` |
| vehicles | `POST /clients/:clientId/vehicles`, `PATCH /vehicles/:id`, `DELETE /vehicles/:id` |
| documents | `GET /documents` (filtros status, type, clientId, quoteId), `POST /documents` (multipart: file, type, clientId?, quoteId?), `GET /documents/:id` (metadata), `GET /documents/:id/download` (URL pré-assinada), `PATCH /documents/:id/status`, `DELETE /documents/:id` |
| quotes | `GET /quotes` (filtros status[], assignedUserId, insurerId, insuranceType, priority, from, to, search), `POST /quotes`, `GET /:id`, `PATCH /:id`, `PATCH /:id/auto-details`, `PATCH /:id/status` `{ status, lostReason?, reason? }`, `PATCH /:id/assign`, `GET /:id/history`, `GET /quotes/kanban` (agrupado por status), `GET /:id/comparison`, `POST /:id/proposal-pdf`, `GET /:id/message-template` |
| insurers | CRUD (`POST/PATCH/DELETE` ADMIN) |
| quote-insurers | `GET /quotes/:id/insurers`, `POST /quotes/:id/insurers` `{ insurerIds[] }`, `PATCH /quote-insurers/:id` (status, notes), `DELETE /quote-insurers/:id` |
| proposals | `GET /quotes/:id/proposals`, `POST /quote-insurers/:id/proposals` (com coverages[] e assistances[]), `PATCH /proposals/:id`, `POST /proposals/:id/select`, `POST /proposals/:id/file` (multipart), `DELETE /proposals/:id` |
| tasks | `GET /tasks` (status, userId, quoteId, clientId, overdue, from, to), `POST`, `PATCH /:id`, `PATCH /:id/status`, `DELETE /:id` |
| notifications | `GET /notifications` (unreadOnly), `PATCH /notifications/:id/read`, `POST /notifications/read-all` |
| audit | `GET /audit?entity=&entityId=` |
| dashboard | `GET /dashboard/summary` (cards + por status + alertas), `GET /dashboard/activity` |
| health | `GET /health` |

## B8. Máquina de estados da cotação

`packages/shared/src/quotes/status-machine.ts` — função pura `canTransition(from, to, snapshot) → { ok: true } | { ok: false, reason }`.

Transições permitidas (avanço linear + volta de um passo + saídas):

```
NEW → WAITING_DOCUMENTS | DATA_COMPLETE
WAITING_DOCUMENTS → DATA_COMPLETE | NEW
DATA_COMPLETE → QUOTING | WAITING_DOCUMENTS
QUOTING → WAITING_PROPOSALS | DATA_COMPLETE
WAITING_PROPOSALS → PROPOSALS_RECEIVED | QUOTING
PROPOSALS_RECEIVED → PROPOSAL_SENT | WAITING_PROPOSALS
PROPOSAL_SENT → NEGOTIATION | WON | PROPOSALS_RECEIVED
NEGOTIATION → WON | PROPOSAL_SENT
qualquer aberto → LOST | CANCELLED
WON/LOST/CANCELLED → (terminal; reabrir = LOST/CANCELLED → NEGOTIATION ou PROPOSALS_RECEIVED, ADMIN/MANAGER)
```

Guards (snapshot `{ pendingRequiredDocs, proposalCount, hasSelectedProposal, lostReason }`):

- `→ DATA_COMPLETE` (e qualquer status posterior a partir de anteriores): `pendingRequiredDocs === 0`
- `→ PROPOSAL_SENT`: `proposalCount ≥ 1`
- `→ WON`: `hasSelectedProposal`
- `→ LOST`: `lostReason` obrigatório

Efeitos automáticos determinísticos (no service):
- Upload de documento em cotação NEW → sugere (não força) WAITING_DOCUMENTS; quando todos obrigatórios VALIDATED, notifica.
- Primeira proposta registrada em cotação em WAITING_PROPOSALS → status vira PROPOSALS_RECEIVED automaticamente (registrado no histórico com `reason: "auto"`).
- Adicionar seguradoras em DATA_COMPLETE → QUOTING automaticamente.
- Selecionar proposta: demais propostas da cotação → REJECTED.

## B9. Cálculos (`packages/shared/src/calculations`)

```
difference(a, b)            = a - b
percentageDifference(a, b)  = ((a - b) / b) * 100      (b = 0 → null)
installmentTotal(amount, n) = amount * n
commission(premium, pct)    = premium * pct / 100
highlightBest(proposals)    → { lowestPremiumIds[], lowestDeductibleIds[] } (empates incluídos)
comparisonMatrix(proposals) → linhas: prêmio, 1ª parcela, parcelas, total parcelado, franquia, tipo franquia, validade, coberturas ∪, assistências ∪
```
Todas com testes unitários (decimal.js; arredondamento HALF_UP 2 casas).

## B10. Documentos e storage

- Upload multipart, limite `MAX_UPLOAD_MB` (10), MIME allowlist `application/pdf, image/jpeg, image/png, image/webp`, magic bytes checados com `file-type`.
- Chave S3: `org/{organizationId}/clients/{clientId}/{uuid}.{ext}` ou `.../quotes/{quoteId}/...`. Bucket privado.
- Download: API valida tenant → URL pré-assinada 60 s. Front abre em viewer (PDF via `<iframe>`, imagem via `<img>`) lado a lado com o formulário para digitação manual.
- Documentos obrigatórios por org (`required_document_types`); `pendingRequiredDocs` = tipos obrigatórios sem documento VALIDATED na cotação (ou no cliente, herdado se `client_id` igual e sem `quote_id`).

## B11. PDF da proposta comercial

- Template `apps/api/templates/proposal/proposal.hbs` + `proposal.css` (A4, print-friendly).
- Seções: capa (logo/dados da corretora) · dados do cliente · dados do veículo · seguradora · coberturas · assistências · franquia · valores (total, 1ª parcela, parcelas) · forma de pagamento · validade · observações · contato do corretor · rodapé fixo: *"Esta proposta está sujeita às condições da seguradora e não representa, isoladamente, emissão da apólice."*
- Gerado por Puppeteer (`page.pdf({ format: 'A4', printBackground: true })`), enviado ao S3, registrado como `document` type PROPOSAL na cotação, audit `SEND`.
- Concorrência: fila em memória serial (1 render por vez) — suficiente para o MVP.

## B12. Jobs (cron)

| Job | Agenda | Regra | Idempotência |
|---|---|---|---|
| StaleQuotesJob | 07:00 diário | quotes abertas com `last_activity_at < now - stale_quote_days` | `dedupe_key = date` |
| ExpiringProposalsJob | 07:05 diário | `validity_date` em 3 dias → task + notif; `validity_date < hoje` e status RECEIVED/SELECTED → EXPIRED | `dedupe_key = proposal_id` |
| OverdueTasksJob | a cada hora | TODO/IN_PROGRESS com `due_date < now` | `dedupe_key = date` |

Crons iteram por organização usando `prisma.forOrganization(orgId)`.

## B13. Segurança

argon2id · helmet · CORS restrito · `@nestjs/throttler` (login 5/min/IP, geral 100/min) · zod em todos os inputs (strip desconhecidos) · Prisma (parametrizado) · React escapa saída; sem `dangerouslySetInnerHTML` com dados de usuário · cookies httpOnly + SameSite + origin check · upload limitado e validado · bucket privado · logs pino com redaction (`password`, `document`, `authorization`, `cookie`) · CPF/CNPJ mascarados em listagens (`***.456.789-**`) · soft delete · `.env.example` sem segredos reais.

## B14. Frontend

- App Router; `(auth)/login`, `(auth)/forgot-password`, `(auth)/reset-password`; `(app)/` com layout (sidebar + topbar) protegido por middleware que checa cookie.
- Data fetching: TanStack Query + `api-client` (fetch com `credentials: 'include'`, refresh automático em 401).
- Forms: react-hook-form + zod (schemas de `packages/shared`).
- Tabelas: TanStack Table + paginação server-side.
- Kanban: `@dnd-kit`. Gráfico: Recharts. Toasts: sonner. Máscaras: CPF/CNPJ/telefone/CEP/moeda em `lib/formatters`.
- Responsivo: sidebar colapsa em drawer < 1024 px; Dashboard, Tarefas, Cliente e Cotação testados em 375 px.

## B15. Testes

- Unit (Vitest): cálculos, máquina de estados, validadores CPF/CNPJ, permissões, formatters.
- Integração (Vitest + Postgres do compose, banco `insurance_test`): auth, tenant isolation, cliente+cotação, cotação+seguradora, cotação+proposta, usuário+organização, transições de status com guards.
- E2E (Playwright): fluxo completo dos critérios de aceite.

## B16. Seed (`packages/database/prisma/seed.ts`)

Organização "Corretora Demo" (CNPJ fictício 00.000.000/0001-91); usuários `admin@demo.local`, `gestor@demo.local`, `corretor@demo.local` (senha `Demo@12345`); seguradoras Porto Seguro, Azul, Tokio Marine, Allianz; 5 clientes fictícios (CPFs válidos por dígito mas claramente fictícios, nomes "Cliente Demo N"); 10 cotações distribuídas pelos status, com veículos, consultas, propostas, coberturas, tarefas e histórico. Idempotente (upsert por chaves naturais).

## B17. Variáveis de ambiente

```
NODE_ENV, API_PORT=3001, WEB_URL=http://localhost:3000, API_URL=http://localhost:3001
DATABASE_URL=postgresql://insurance:insurance@localhost:5432/insurance
JWT_ACCESS_SECRET, JWT_ACCESS_TTL=15m, REFRESH_TTL_DAYS=7, COOKIE_DOMAIN=
S3_ENDPOINT=http://localhost:9000, S3_REGION=us-east-1, S3_BUCKET=insurance-documents, S3_ACCESS_KEY, S3_SECRET_KEY, S3_FORCE_PATH_STYLE=true
MAX_UPLOAD_MB=10, PUPPETEER_EXECUTABLE_PATH=
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

## B18. Riscos

| Risco | Mitigação |
|---|---|
| Vazamento cross-tenant | Extension Prisma obrigatória + teste de isolamento por módulo |
| Puppeteer em Docker | Imagem `node:24-bookworm-slim` + Chromium via apt; `PUPPETEER_EXECUTABLE_PATH` |
| Versões Next 15 / React 19 / shadcn | Versões fixadas |
| Precisão monetária | Decimal no banco e nos cálculos, testes com centavos |
| Scope creep | Tudo fora do MVP vai para "Futuro" neste documento |

---

# PARTE C — PLANO DE EXECUÇÃO

Cada fase termina com `npm run lint`, `npm run typecheck`, `npm test` verdes e commit.

**Status (15/09/2026): fases 0–8 implementadas.** Decisões tomadas durante a execução, além do planejado:

- Postgres exposto na porta **5433** do host (5432 estava ocupada na máquina de desenvolvimento); MinIO via `quay.io/minio/minio`.
- `consistent-type-imports` do ESLint desativado em `apps/api` (a injeção de dependências do NestJS precisa das classes em runtime).
- Verificação de MIME por magic bytes implementada manualmente (`infra/storage/upload.ts`) em vez da dependência `file-type` (ESM-only).
- Primeira proposta registrada em cotação `QUOTING` avança automaticamente por `WAITING_PROPOSALS` até `PROPOSALS_RECEIVED`.
- Reatribuição de cotação: `PATCH /quotes/:id/assign` (ADMIN/MANAGER); BROKER só pode assumir cotações sem responsável.
- Endpoint extra `GET /quotes/:id/proposal-preview` (HTML do mesmo template) para conferência antes do PDF.
- Notificações in-app adicionais: documento/proposta recebidos por outro usuário avisam o responsável da cotação.

| Fase | Entregas |
|---|---|
| 0 | git init, IMPLEMENTATION_PLAN.md, ARCHITECTURE.md, DATABASE.md, BUSINESS_RULES.md, README.md |
| 1 | Workspaces, tooling, `packages/database` (schema + migration), `packages/shared` base, `apps/api` (Nest, config, Prisma, health, auth completa, TenantContext + extension + teste de isolamento), `apps/web` (Next, Tailwind, shadcn, layout, login), docker-compose, .env.example |
| 2 | Organizations (settings, logo), Users (CRUD ADMIN, perfil, senha), RBAC + testes, telas Configurações |
| 3 | Clients, Vehicles, Documents (upload MinIO, viewer, status), telas Clientes |
| 4 | Quotes (CRUD, numeração, auto-details, status-machine, histórico, Kanban, filtros, motivo de perda), wizard |
| 5 | Insurers, QuoteInsurers, Proposals (+coverages, +assistances, arquivo, seleção), abas na cotação |
| 6 | Calculations + testes, Comparison, template + PDF, "Copiar mensagem" |
| 7 | Tasks, Notifications, crons, aba Histórico, Tarefas mobile |
| 8 | Dashboard, UX (empty/skeleton/toast), responsividade, hardening, seed completo, E2E, docs finais |

## Fase 9 (incremental, pós-MVP): cálculos financeiros e indicadores

Adicionada após o MVP, a pedido do usuário ("cálculos automáticos de todos os tipos"). Escopo confirmado: cálculos financeiros da proposta, indicadores do dashboard, e cálculos por tipo de seguro (mantendo Auto completo; demais tipos seguem na seção "Futuro").

- `packages/shared/src/calculations/financial.ts`: `netPremiumFromGross`/`iofFromGross`/`breakdownGrossPremium` (decomposição do prêmio em líquido + IOF), `installmentWithInterest` (PMT/tabela Price), `proRataPremium` (proporcional para cancelamento), `renewalComparison` (economia vs. apólice vigente). Todas puras e testadas.
- `organization_settings.iof_rate_percent` (padrão 7,38%) e `organization_settings.monthly_revenue_goal` (meta mensal, opcional) — novos campos configuráveis pelo ADMIN em Configurações.
- `quotes.expiring_premium` — prêmio da apólice vigente, informado manualmente na aba Visão Geral da cotação (fluxo de renovação); usado no comparativo para calcular a economia por seguradora.
- Comparativo (`/quotes/:id/comparison`): cada coluna passa a expor `netPremium`, `iofAmount` e `renewal` (economia vs. apólice vigente, quando informada).
- Dashboard (`/dashboard/summary`): bloco `financial` (prêmio e comissão realizados no mês, receita projetada do pipeline — comissão estimada de propostas selecionadas em cotações ainda abertas —, meta mensal e progresso), `monthlyEvolution` (prêmio fechado nos últimos 6 meses) e `brokerRanking` (ranking de corretores no mês, visível apenas para ADMIN/MANAGER).
- Todos os cálculos continuam determinísticos (regras matemáticas), sem IA.

## Fase 10 (incremental, pós-MVP): modo escuro e ordenação por cabeçalho

Melhorias de UX pedidas pelo usuário após revisão do produto.

- **Modo escuro**: paleta `.dark` completa em `globals.css` (Tailwind v4 `@custom-variant dark`), toggle de 3 estados (Claro/Escuro/Sistema) em `components/layout/theme-toggle.tsx`, persistido em `localStorage` e aplicado antes da hidratação via script inline em `layout.tsx` (evita flash do tema errado). Badges e alertas com cores fixas (`bg-emerald-50`, `bg-amber-50` etc.) ganharam variantes `dark:` para manter contraste.
- **Ordenação por cabeçalho**: `components/ui/sortable-table-head.tsx` (genérico, reaproveita o estado `sort` "campo:direção" já usado pelas listagens). Aplicado em Clientes, Cotações, Usuários, Documentos e Seguradoras, substituindo os `Select` de ordenação onde redundantes.

## Futuro (não implementar agora)

WhatsApp Business API (gerar mensagens prontas já existe como texto copiável) · e-mail SMTP real (trocar `MailerService` stub) · APIs de seguradoras (interface `InsurerGateway` por seguradora, entrada manual permanece como fallback) · importação de planilhas (`ImportJob` com etapas upload → leitura → preview → validação → erros → confirmação → importação) · webhooks de saída · gateway de pagamento/assinatura do SaaS · portal do cliente · outros tipos de seguro (tabelas `quote_<tipo>_details`).
