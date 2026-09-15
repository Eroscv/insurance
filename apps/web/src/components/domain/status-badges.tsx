import {
  DOCUMENT_STATUS_LABELS,
  PRIORITY_LABELS,
  PROPOSAL_STATUS_LABELS,
  QUOTE_INSURER_STATUS_LABELS,
  QUOTE_STATUS_LABELS,
  TASK_STATUS_LABELS,
  type DocumentStatus,
  type Priority,
  type ProposalStatus,
  type QuoteInsurerStatus,
  type QuoteStatus,
  type TaskStatus,
} from '@insurance/shared';
import { Badge } from '@/components/ui/badge';

type Variant = 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive' | 'info' | 'muted';

const QUOTE: Record<QuoteStatus, Variant> = {
  NEW: 'muted',
  WAITING_DOCUMENTS: 'warning',
  DATA_COMPLETE: 'info',
  QUOTING: 'info',
  WAITING_PROPOSALS: 'warning',
  PROPOSALS_RECEIVED: 'info',
  PROPOSAL_SENT: 'default',
  NEGOTIATION: 'default',
  WON: 'success',
  LOST: 'destructive',
  CANCELLED: 'muted',
};
export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return <Badge variant={QUOTE[status]}>{QUOTE_STATUS_LABELS[status]}</Badge>;
}

const DOC: Record<DocumentStatus, Variant> = { PENDING: 'warning', RECEIVED: 'info', VALIDATED: 'success', REJECTED: 'destructive' };
export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  return <Badge variant={DOC[status]}>{DOCUMENT_STATUS_LABELS[status]}</Badge>;
}

const QI: Record<QuoteInsurerStatus, Variant> = { NOT_STARTED: 'muted', REQUESTED: 'info', WAITING: 'warning', RECEIVED: 'success', REFUSED: 'destructive', NO_RESPONSE: 'destructive', CANCELLED: 'muted' };
export function QuoteInsurerStatusBadge({ status }: { status: QuoteInsurerStatus }) {
  return <Badge variant={QI[status]}>{QUOTE_INSURER_STATUS_LABELS[status]}</Badge>;
}

const PROP: Record<ProposalStatus, Variant> = { RECEIVED: 'info', SELECTED: 'success', REJECTED: 'muted', EXPIRED: 'destructive' };
export function ProposalStatusBadge({ status }: { status: ProposalStatus }) {
  return <Badge variant={PROP[status]}>{PROPOSAL_STATUS_LABELS[status]}</Badge>;
}

const TASK: Record<TaskStatus, Variant> = { TODO: 'muted', IN_PROGRESS: 'info', DONE: 'success', CANCELLED: 'muted' };
export function TaskStatusBadge({ status, overdue }: { status: TaskStatus; overdue?: boolean }) {
  if (overdue && (status === 'TODO' || status === 'IN_PROGRESS')) return <Badge variant="destructive">Atrasada</Badge>;
  return <Badge variant={TASK[status]}>{TASK_STATUS_LABELS[status]}</Badge>;
}

const PRIO: Record<Priority, Variant> = { LOW: 'muted', MEDIUM: 'secondary', HIGH: 'warning' };
export function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge variant={PRIO[priority]}>{PRIORITY_LABELS[priority]}</Badge>;
}
