import { useQuery } from '@tanstack/react-query';
import type { QuoteStatus } from '@insurance/shared';
import { apiClient } from '../api-client';
import type { AuditRow } from './clients';

export interface DashboardSummary {
  cards: { open: number; waitingDocuments: number; proposalsReceived: number; proposalsSent: number; won: number; lost: number; wonMonth: number; lostMonth: number; overdueTasks: number; myOpenTasks: number };
  financial: { wonPremiumMonth: string; wonCommissionMonth: string; projectedCommission: string; monthlyGoal: string | null; goalProgressPercent: string | null };
  byStatus: { status: QuoteStatus; count: number }[];
  monthlyEvolution: { month: string; won: number; wonPremium: string }[];
  brokerRanking: { userId: string; name: string; wonCount: number; wonPremium: string }[] | null;
  alerts: {
    staleQuotes: { id: string; quoteNumber: number; lastActivityAt: string; client: { name: string } }[];
    pendingDocuments: { id: string; quoteNumber: number; clientName: string; pending: string[] }[];
    pendingDocumentsTotal: number;
  };
}
export function useDashboard() {
  return useQuery({ queryKey: ['dashboard', 'summary'], queryFn: () => apiClient.get<DashboardSummary>('/dashboard/summary'), refetchInterval: 120_000 });
}
export function useActivity() {
  return useQuery({ queryKey: ['dashboard', 'activity'], queryFn: () => apiClient.get<AuditRow[]>('/dashboard/activity') });
}
