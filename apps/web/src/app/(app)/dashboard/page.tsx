'use client';
import { DOCUMENT_TYPE_LABELS, formatBRL, formatDate, formatQuoteNumber, percentageDifference, QUOTE_STATUS_LABELS, type DocumentType } from '@insurance/shared';
import { AlertTriangle, CheckSquare, FileText, FolderOpen, Medal, Send, ThumbsDown, Trophy, Clock, Target, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader } from '@/components/layout/page-header';
import { AuditTimeline } from '@/components/domain/audit-timeline';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendBadge } from '@/components/ui/trend-badge';
import { useMe } from '@/lib/queries/auth';
import { useActivity, useDashboard } from '@/lib/queries/dashboard';
import { cn } from '@/lib/utils';

const CHART_AXIS = { fontSize: 11, fill: 'var(--muted-foreground)' };
const CHART_TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: 'var(--popover)', borderColor: 'var(--border)', borderRadius: 8, color: 'var(--popover-foreground)', fontSize: 12 },
  labelStyle: { color: 'var(--popover-foreground)' },
  itemStyle: { color: 'var(--popover-foreground)' },
};

function Stat({ label, value, icon: Icon, href, tone }: { label: string; value: number; icon: React.ElementType; href: string; tone?: 'ok' | 'warn' | 'bad' }) {
  return (
    <Link href={href} className="rounded-lg border bg-card p-4 shadow-sm shadow-black/[0.03] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/[0.06]">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        <Icon className={cn('size-4', tone === 'ok' ? 'text-emerald-600' : tone === 'warn' ? 'text-amber-600' : tone === 'bad' ? 'text-red-600' : 'text-muted-foreground')} />
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </Link>
  );
}

export default function DashboardPage() {
  const { data: me } = useMe();
  const { data, isLoading } = useDashboard();
  const { data: activity } = useActivity();
  if (isLoading || !data) return <><PageHeader title="Dashboard" /><div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div></>;
  const c = data.cards;
  const f = data.financial;
  const chart = data.byStatus.filter((s) => !['LOST', 'CANCELLED'].includes(s.status) || s.count > 0).map((s) => ({ name: QUOTE_STATUS_LABELS[s.status], count: s.count }));
  const evolutionChart = data.monthlyEvolution.map((m) => ({ name: new Date(`${m.month}-02`).toLocaleDateString('pt-BR', { month: 'short' }), premium: Number(m.wonPremium) }));
  // Tendência real: mês atual vs. anterior, a partir do histórico já calculado no backend (sem valor inventado).
  const [prevMonth, currentMonth] = data.monthlyEvolution.slice(-2);
  const premiumTrend = prevMonth && currentMonth ? percentageDifference(currentMonth.wonPremium, prevMonth.wonPremium) : null;
  return (
    <>
      <PageHeader title={`Olá, ${me?.name.split(' ')[0] ?? ''}`} description="Visão geral da operação de cotação." />
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Cotações abertas" value={c.open} icon={FileText} href="/quotes" />
        <Stat label="Aguardando documentos" value={c.waitingDocuments} icon={FolderOpen} href="/quotes?status=WAITING_DOCUMENTS" tone="warn" />
        <Stat label="Propostas recebidas" value={c.proposalsReceived} icon={Clock} href="/quotes?status=PROPOSALS_RECEIVED" />
        <Stat label="Propostas enviadas" value={c.proposalsSent} icon={Send} href="/quotes?status=PROPOSAL_SENT" />
        <Stat label="Fechadas" value={c.won} icon={Trophy} href="/quotes?status=WON" tone="ok" />
        <Stat label="Perdidas" value={c.lost} icon={ThumbsDown} href="/quotes?status=LOST" tone="bad" />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wide"><Trophy className="size-3.5 text-emerald-600" /> Prêmio fechado no mês</p>
            <div className="mt-2 flex items-center gap-2">
              <p className="text-2xl font-semibold">{formatBRL(f.wonPremiumMonth)}</p>
              <TrendBadge percentage={premiumTrend === null ? null : Number(premiumTrend)} />
            </div>
            <p className="text-xs text-muted-foreground">Comissão realizada: {formatBRL(f.wonCommissionMonth)}{prevMonth ? ` · mês anterior: ${formatBRL(prevMonth.wonPremium)}` : ''}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wide"><TrendingUp className="size-3.5 text-sky-600" /> Receita projetada (pipeline)</p>
            <p className="mt-2 text-2xl font-semibold">{formatBRL(f.projectedCommission)}</p>
            <p className="text-xs text-muted-foreground">Comissão estimada de propostas selecionadas em cotações abertas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wide"><Target className="size-3.5 text-amber-600" /> Meta mensal</p>
            {f.monthlyGoal ? (
              <>
                <p className="mt-2 text-2xl font-semibold">{f.goalProgressPercent}%</p>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Number(f.goalProgressPercent))}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{formatBRL(f.wonPremiumMonth)} de {formatBRL(f.monthlyGoal)}</p>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Sem meta definida. <Link href="/settings" className="text-primary hover:underline">Configurar</Link></p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Cotações por status</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} margin={{ left: -20, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ ...CHART_AXIS, fontSize: 10 }} axisLine={{ stroke: 'var(--border)' }} tickLine={{ stroke: 'var(--border)' }} interval={0} angle={-25} textAnchor="end" height={60} />
                  <YAxis allowDecimals={false} tick={CHART_AXIS} axisLine={{ stroke: 'var(--border)' }} tickLine={{ stroke: 'var(--border)' }} />
                  <Tooltip cursor={{ fill: 'var(--muted)' }} formatter={(v) => [v, 'Cotações']} {...CHART_TOOLTIP_STYLE} />
                  <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Este mês: {c.wonMonth} fechada(s) · {c.lostMonth} perdida(s)</p>
          </CardContent>
        </Card>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><CheckSquare className="size-4" /> Tarefas</CardTitle></CardHeader>
            <CardContent className="text-sm">
              <p><Link href="/tasks" className="hover:underline">{c.myOpenTasks} tarefa(s) sua(s) em aberto</Link></p>
              {c.overdueTasks > 0 ? <p className="text-red-700"><Link href="/tasks" className="hover:underline">{c.overdueTasks} atrasada(s) na equipe</Link></p> : <p className="text-muted-foreground">Nenhuma tarefa atrasada.</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="size-4 text-amber-600" /> Alertas</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <div>
                <p className="mb-1 font-medium">Documentos pendentes ({data.alerts.pendingDocumentsTotal})</p>
                {data.alerts.pendingDocuments.length === 0 ? <p className="text-muted-foreground">Nenhum.</p> : (
                  <ul className="space-y-1">
                    {data.alerts.pendingDocuments.map((q) => <li key={q.id}><Link href={`/quotes/${q.id}?tab=documents`} className="hover:underline"><span className="font-mono text-xs">{formatQuoteNumber(q.quoteNumber)}</span> {q.clientName}</Link> <span className="text-xs text-muted-foreground">— {q.pending.map((t) => DOCUMENT_TYPE_LABELS[t as DocumentType]).join(', ')}</span></li>)}
                  </ul>
                )}
              </div>
              <div>
                <p className="mb-1 font-medium">Cotações paradas ({data.alerts.staleQuotes.length})</p>
                {data.alerts.staleQuotes.length === 0 ? <p className="text-muted-foreground">Nenhuma.</p> : (
                  <ul className="space-y-1">
                    {data.alerts.staleQuotes.map((q) => <li key={q.id}><Link href={`/quotes/${q.id}`} className="hover:underline"><span className="font-mono text-xs">{formatQuoteNumber(q.quoteNumber)}</span> {q.client.name}</Link> <span className="text-xs text-muted-foreground">— desde {formatDate(q.lastActivityAt)}</span></li>)}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Evolução do prêmio fechado (6 meses)</CardTitle></CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolutionChart} margin={{ left: -10, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="name" tick={CHART_AXIS} axisLine={{ stroke: 'var(--border)' }} tickLine={{ stroke: 'var(--border)' }} />
                  <YAxis tick={CHART_AXIS} axisLine={{ stroke: 'var(--border)' }} tickLine={{ stroke: 'var(--border)' }} tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))} />
                  <Tooltip formatter={(v) => [formatBRL(v as number), 'Prêmio fechado']} {...CHART_TOOLTIP_STYLE} />
                  <Line type="monotone" dataKey="premium" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3, fill: 'var(--primary)' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        {data.brokerRanking ? (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Medal className="size-4 text-amber-600" /> Ranking do mês</CardTitle></CardHeader>
            <CardContent>
              {data.brokerRanking.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma cotação fechada este mês ainda.</p>
              ) : (
                <ol className="flex flex-col gap-2">
                  {data.brokerRanking.map((r, i) => (
                    <li key={r.userId} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2"><span className="flex size-5 items-center justify-center rounded-full bg-muted text-xs font-medium">{i + 1}</span>{r.name}</span>
                      <span className="text-right"><span className="font-medium">{formatBRL(r.wonPremium)}</span><span className="ml-1 text-xs text-muted-foreground">({r.wonCount})</span></span>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
      <Card className="mt-4">
        <CardHeader><CardTitle>Atividades recentes</CardTitle></CardHeader>
        <CardContent>{activity ? <AuditTimeline rows={activity} /> : <Skeleton className="h-32" />}</CardContent>
      </Card>
    </>
  );
}
