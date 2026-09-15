# BUSINESS_RULES

Fonte canônica das regras. Implementação: `packages/shared` (regras puras) e services em `apps/api/src/modules`.

## 1. Multi-tenant
- Todo dado operacional pertence a uma organização. Um usuário nunca vê dados de outra organização.
- Recurso de outra organização responde **404** (não 403) para não vazar existência.

## 2. Perfis
| Ação | ADMIN | MANAGER | BROKER |
|---|---|---|---|
| Gerenciar organização e usuários | ✔ | ✖ | ✖ |
| Gerenciar seguradoras | ✔ | ✖ | ✖ |
| Ver todas as cotações | ✔ | ✔ | ✔ |
| Editar cotação de outro corretor / reatribuir | ✔ | ✔ | ✖ |
| Reabrir cotação WON/LOST/CANCELLED | ✔ | ✔ | ✖ |
| Excluir cliente/cotação/proposta | ✔ | ✔ | ✖ (apenas os próprios rascunhos NEW) |
| CRUD clientes, cotações próprias, propostas, tarefas, documentos | ✔ | ✔ | ✔ |

## 3. Clientes
- CPF/CNPJ validado por dígito verificador; armazenado só com dígitos.
- CPF/CNPJ único por organização (entre clientes não excluídos). Duplicado → 409 com link para o existente.
- Exclusão é soft; cliente com cotações abertas não pode ser excluído.

## 4. Veículos
- Pertencem a um cliente; cliente pode ter vários.
- `model_year >= manufacturing_year` e `model_year <= manufacturing_year + 1`.
- Placa opcional (zero km); se informada, formato Mercosul ou antigo.

## 5. Documentos
- Tipos: CNH, CRLV, ID, ADDRESS_PROOF, PROPOSAL, OTHER. Status: PENDING, RECEIVED, VALIDATED, REJECTED.
- Upload cria com status RECEIVED. Somente usuário humano muda para VALIDATED/REJECTED (`validated_by`, `validated_at`).
- Tipos obrigatórios definidos por organização (default CNH + CRLV).
- `pendingRequiredDocs(quote)` = tipos obrigatórios sem documento VALIDATED vinculado à cotação **ou** ao cliente da cotação (documentos do cliente valem para todas as suas cotações).
- Limite 10 MB; MIME permitido: PDF, JPEG, PNG, WEBP; magic bytes verificados.
- Arquivos nunca são públicos; acesso via URL pré-assinada de 60 s, após verificação de tenant.
- Nenhuma leitura automática de conteúdo (sem OCR). O usuário visualiza e digita.

## 6. Cotações
- Sempre tem cliente. Veículo obrigatório para AUTO antes de DATA_COMPLETE.
- Numeração sequencial por organização (`#000001`), nunca reutilizada.
- `last_activity_at` atualizado em qualquer mutação da cotação ou de seus filhos (documento, consulta, proposta, tarefa, status).
- Prioridade: LOW, MEDIUM, HIGH.

### 6.1 Transições de status
```
NEW → WAITING_DOCUMENTS | DATA_COMPLETE
WAITING_DOCUMENTS → DATA_COMPLETE | NEW
DATA_COMPLETE → QUOTING | WAITING_DOCUMENTS
QUOTING → WAITING_PROPOSALS | DATA_COMPLETE
WAITING_PROPOSALS → PROPOSALS_RECEIVED | QUOTING
PROPOSALS_RECEIVED → PROPOSAL_SENT | WAITING_PROPOSALS
PROPOSAL_SENT → NEGOTIATION | WON | PROPOSALS_RECEIVED
NEGOTIATION → WON | PROPOSAL_SENT
<qualquer aberto> → LOST | CANCELLED
LOST | CANCELLED → PROPOSALS_RECEIVED | NEGOTIATION   (reabrir; ADMIN/MANAGER)
WON → (terminal)
```

### 6.2 Guards
| Destino | Exige |
|---|---|
| DATA_COMPLETE (ou qualquer status posterior a partir de NEW/WAITING_DOCUMENTS) | 0 documentos obrigatórios pendentes; veículo vinculado (AUTO) |
| PROPOSAL_SENT | ≥ 1 proposta cadastrada (não EXPIRED/REJECTED) |
| WON | exatamente 1 proposta SELECTED |
| LOST | `lost_reason` ∈ {PRICE, CLIENT_GAVE_UP, COMPETITOR, INSURER_REFUSED, NO_RESPONSE, OTHER}; OTHER exige `lost_notes` |

### 6.3 Efeitos automáticos (determinísticos)
- Adicionar seguradoras a cotação em DATA_COMPLETE → QUOTING (histórico `reason: "auto:insurers_added"`).
- Marcar consulta como REQUESTED em cotação QUOTING → WAITING_PROPOSALS quando **todas** as consultas ativas estiverem REQUESTED/WAITING.
- Primeira proposta em cotação DATA_COMPLETE, QUOTING ou WAITING_PROPOSALS → PROPOSALS_RECEIVED (`auto:first_proposal`, passando pelos status intermediários; registrar proposta implica que a seguradora foi consultada).
- Gerar PDF da proposta comercial → registra documento PROPOSAL + audit SEND; **não** muda status (o corretor confirma envio manualmente).
- WON/LOST/CANCELLED preenchem `closed_at`; reabrir limpa `closed_at`, `lost_reason`.
- Todo movimento de status registra `quote_status_history` e `audit_logs`.

## 7. Consultas (quote_insurers)
- Uma seguradora por cotação (unique). Só seguradoras ativas.
- Status: NOT_STARTED → REQUESTED (`requested_at`) → WAITING → RECEIVED (`responded_at`) | REFUSED | NO_RESPONSE | CANCELLED.
- Registrar proposta muda a consulta para RECEIVED automaticamente.

## 8. Propostas
- Sempre vinculadas a uma consulta (`quote_insurer_id`).
- `installments ≥ 1`; se `installments > 1`, `installment_amount` obrigatório.
- Seleção: uma proposta SELECTED por cotação; selecionar outra rejeita a anterior (RECEIVED → REJECTED, SELECTED anterior → RECEIVED). Registrado em audit SELECT_PROPOSAL.
- Proposta EXPIRED não pode ser selecionada.
- `validity_date` default = hoje + `proposal_validity_days` da organização quando não informada.

## 9. Comparativo e cálculos
- Menor prêmio: menor `total_amount` (empates: todos destacados).
- Menor franquia: menor `deductible_amount` não nulo (empates: todos).
- Diferença = A − B; diferença % = (A − B) / B × 100 (B = 0 → não calculável).
- Total parcelado = `installment_amount × installments`.
- Comissão = prêmio × % / 100 (% da proposta, senão % padrão da organização).
- Arredondamento HALF_UP, 2 casas. Sem float.

## 10. Proposta comercial (PDF)
- Requer proposta SELECTED (ou proposta explicitamente escolhida na chamada).
- Conteúdo fixo por template; rodapé obrigatório: *"Esta proposta está sujeita às condições da seguradora e não representa, isoladamente, emissão da apólice."*
- Gera documento tipo PROPOSAL na cotação; regerar cria nova versão (documento anterior permanece).

## 11. Tarefas
- Status: TODO, IN_PROGRESS, DONE, CANCELLED. DONE preenche `completed_at`.
- Atrasada = status ∈ {TODO, IN_PROGRESS} e `due_date < agora` (derivado, não persistido).
- Criar tarefa para outro usuário gera notificação NEW_TASK.

## 12. Notificações e automações
| Evento | Regra | Notifica |
|---|---|---|
| Cotação parada | aberta e `last_activity_at < hoje − stale_quote_days` (job diário) | responsável (ou ADMINs se sem responsável) |
| Proposta vencendo | `validity_date = hoje + 3` (job diário) → cria task "Proposta X vence em 3 dias" | responsável da cotação |
| Proposta vencida | `validity_date < hoje` e RECEIVED/SELECTED → EXPIRED | responsável |
| Tarefa vencida | job horário | dono da tarefa |
| Documento recebido | upload | responsável da cotação |
| Proposta recebida | registro | responsável da cotação |
| Documento pendente | dashboard em tempo real | — |
Idempotência por `dedupe_key` (data ou id do recurso).

## 12.1 Notificações in-app disparadas por ações
- NEW_TASK ao criar tarefa para outro usuário.
- DOCUMENT_RECEIVED e PROPOSAL_RECEIVED para o responsável da cotação quando outro usuário registra o documento/proposta.

## 13. Auditoria
Registrar CREATE/UPDATE/DELETE/STATUS_CHANGE/UPLOAD/SEND/SELECT_PROPOSAL/LOGIN com `old_data`/`new_data` (sem `password_hash`, sem conteúdo de arquivo). Histórico da cotação = `quote_status_history` ∪ `audit_logs` da cotação e filhos, ordenado por data.

## 14. Dados sensíveis
- Senhas: argon2id. Nunca em log.
- CPF/CNPJ mascarados em listagens; completos apenas no detalhe.
- Sem dados reais em seed/testes.
