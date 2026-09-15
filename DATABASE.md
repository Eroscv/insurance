# DATABASE

PostgreSQL 16 · Prisma 6 · schema em `packages/database/prisma/schema.prisma`.

Convenções: `id uuid`, `created_at`/`updated_at timestamptz`, `organization_id` em toda tabela operacional, enums nativos, dinheiro `numeric(12,2)`, percentuais `numeric(5,2)`, soft delete `deleted_at` onde indicado. Nomes de tabela/coluna em snake_case (`@@map`/`@map`), models em PascalCase.

## Diagrama (resumo)

```
organizations 1─1 organization_settings
organizations 1─1 organization_quote_counters
organizations 1─* users 1─* sessions, password_resets
organizations 1─* clients 1─* vehicles
organizations 1─* insurers
clients 1─* quotes *─1 vehicles(opcional) ; quotes *─1 users(assigned)
quotes 1─1 quote_auto_details
quotes 1─* quote_status_history
quotes 1─* quote_insurers *─1 insurers
quote_insurers 1─* proposals 1─* proposal_coverages, proposal_assistances
organizations 1─* documents (*─1 clients?, *─1 quotes?)
organizations 1─* tasks (*─1 users, *─1 clients?, *─1 quotes?)
organizations 1─* notifications *─1 users
organizations 1─* audit_logs
```

## Tabelas

### organizations
| coluna | tipo | obs |
|---|---|---|
| id | uuid PK | |
| name | text | nome fantasia |
| legal_name | text? | razão social |
| document | text? | CNPJ |
| email, phone | text? | |
| logo_key | text? | chave S3 |
| created_at, updated_at | timestamptz | |

### organization_settings
| organization_id | uuid PK/FK |
| commission_percentage | numeric(5,2) default 10 |
| stale_quote_days | int default 5 |
| required_document_types | DocumentType[] default {CNH,CRLV} |
| proposal_validity_days | int default 7 |
| iof_rate_percent | numeric(5,2) default 7.38 — alíquota usada para decompor prêmio em líquido + IOF |
| monthly_revenue_goal | numeric(12,2) nullable — meta mensal de prêmio fechado, exibida no dashboard |
| proposal_footer_text | text? |

### organization_quote_counters
| organization_id | uuid PK/FK | last_number int default 0 |

### users
| id uuid PK | organization_id FK | name | email (unique global) | password_hash | role Role | active bool default true | deleted_at? | timestamps |
Índices: `(organization_id)`, unique `(email)`.

### sessions
| id uuid PK | user_id FK | token_hash text unique | user_agent? | ip? | expires_at | revoked_at? | created_at |

### password_resets
| id uuid PK | user_id FK | token_hash unique | expires_at | used_at? | created_at |

### clients
| id | organization_id | type ClientType | name | document (só dígitos) | birth_date date? | marital_status MaritalStatus? | email? | phone? | whatsapp? | zip_code? | street? | number? | complement? | neighborhood? | city? | state char(2)? | notes? | deleted_at? | timestamps |
Índices: unique parcial `(organization_id, document) where deleted_at is null`; `(organization_id, phone)`, `(organization_id, email)`, `(organization_id, name)`.

### vehicles
| id | organization_id | client_id FK | brand | model | version? | manufacturing_year int | model_year int | plate? | chassis? | renavam? | fuel Fuel? | zero_km bool default false | usage_type text? | overnight_location text? | deleted_at? | timestamps |
Índices: `(organization_id, client_id)`, `(organization_id, plate)`.

### documents
| id | organization_id | client_id? | quote_id? | type DocumentType | file_name | storage_key | mime_type | size int | status DocumentStatus default RECEIVED | uploaded_by FK users | uploaded_at | validated_by? | validated_at? | notes? | deleted_at? | timestamps |
Índices: `(organization_id, quote_id)`, `(organization_id, client_id)`, `(organization_id, status)`.
`file_url` do PRD não é persistida: gerada sob demanda (URL pré-assinada).

### quotes
| id | organization_id | quote_number int | client_id FK | vehicle_id FK? | assigned_user_id FK? | insurance_type InsuranceType default AUTO | status QuoteStatus default NEW | priority Priority default MEDIUM | lost_reason LostReason? | lost_notes? | notes? | expiring_premium numeric(12,2)? | closed_at? | last_activity_at | deleted_at? | timestamps |
Índices: unique `(organization_id, quote_number)`; `(organization_id, status)`, `(organization_id, assigned_user_id)`, `(organization_id, client_id)`, `(organization_id, created_at)`.

### quote_auto_details
| quote_id PK/FK | main_driver_name? | main_driver_document? | main_driver_birth_date? | marital_status? | profession? | residence_zip_code? | vehicle_usage? | annual_mileage int? | has_home_garage bool? | has_work_garage bool? | commercial_use bool? | app_usage bool? | number_of_drivers int? | deductible_type DeductibleType? | desired_coverage text? | timestamps |

### quote_status_history
| id | organization_id | quote_id FK | from_status QuoteStatus? | to_status QuoteStatus | user_id FK? | reason text? | created_at |
Índice `(quote_id, created_at)`.

### insurers
| id | organization_id | name | document? | logo_key? | email? | phone? | website? | active bool default true | notes? | deleted_at? | timestamps |
Índice `(organization_id, name)`.

### quote_insurers
| id | organization_id | quote_id FK | insurer_id FK | status QuoteInsurerStatus default NOT_STARTED | requested_at? | responded_at? | notes? | created_by FK users | timestamps |
Unique `(quote_id, insurer_id)`.

### proposals
| id | organization_id | quote_insurer_id FK | proposal_number? | total_amount numeric(12,2) | first_installment numeric(12,2)? | installment_amount numeric(12,2)? | installments int default 1 | deductible_amount numeric(12,2)? | deductible_type DeductibleType? | commission_percentage numeric(5,2)? | validity_date date? | storage_key? | file_name? | status ProposalStatus default RECEIVED | notes? | timestamps |
Índices: `(organization_id, quote_insurer_id)`, `(organization_id, status, validity_date)`.

### proposal_coverages
| id | proposal_id FK | name | insured_amount numeric(12,2)? | included bool default true | notes? |

### proposal_assistances
| id | proposal_id FK | name | included bool default true | description? |

### tasks
| id | organization_id | user_id FK | client_id? | quote_id? | title | description? | priority Priority default MEDIUM | status TaskStatus default TODO | due_date timestamptz? | completed_at? | created_by FK | timestamps |
Índices: `(organization_id, status, due_date)`, `(organization_id, user_id)`, `(organization_id, quote_id)`.

### notifications
| id | organization_id | user_id FK | type NotificationType | title | body? | entity? | entity_id? | dedupe_key? | read_at? | created_at |
Unique parcial `(organization_id, user_id, type, entity, entity_id, dedupe_key) where dedupe_key is not null`. Índice `(user_id, read_at, created_at)`.

### audit_logs
| id | organization_id | user_id? | entity | entity_id | action AuditAction | old_data jsonb? | new_data jsonb? | created_at |
Índices: `(organization_id, entity, entity_id, created_at)`, `(organization_id, created_at)`.

## Enums

Ver `IMPLEMENTATION_PLAN.md` §B4 (lista completa). Fonte da verdade: `schema.prisma`; espelhados em `packages/shared/src/enums.ts`.

## Migrations e seed

```bash
npm run db:migrate        # prisma migrate dev (dev)
npm run db:deploy         # prisma migrate deploy (prod/CI)
npm run db:seed           # dados fictícios idempotentes
npm run db:studio
```
