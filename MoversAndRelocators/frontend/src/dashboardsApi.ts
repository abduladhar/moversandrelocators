import { request } from './api'

/** Module dashboards (GET /api/dashboards/{sales|operations|finance}); a section is null when the user may not see it. */
export type DashCount = { label: string; count: number; code: string | null; color: string | null }
export type DashSeries = { series: string[]; points: { start: string; values: number[] }[] }
export type DashItem = { kind: string; id: string; number: string; customer: string; atUtc: string; status: string | null; person: string | null; detail: string | null }
export type DashMoney = { currency: string; amount: number }

export type SalesDashboard = {
  leads: { newLeadsThisMonth: number; newLeadsLastMonth: number; openLeads: number; followUpsDueToday: number; followUpsOverdue: number } | null
  leadsPerWeek: DashSeries | null; leadsByStatus: DashCount[] | null; leadsBySource: DashCount[] | null; recentLeads: DashItem[] | null
  surveys: { scheduledNext7Days: number; inProgress: number; completedThisMonth: number; overdue: number } | null; upcomingSurveys: DashItem[] | null
  quotations: { sentThisMonth: number; acceptedThisMonth: number; awaitingAnswer: number; decided90Days: number; accepted90Days: number; acceptedValueThisMonth: DashMoney[] } | null
  quotationOutcomes: DashCount[] | null
}
export type OperationsDashboard = {
  kpis: { pickupsToday: number; packingToday: number; deliveriesToday: number; inProgress: number; overdue: number; boxesInWarehouse: number | null }
  next14Days: DashSeries; today: DashItem[]; overdueJobs: DashItem[]
  pickupsByStatus: DashCount[] | null; packingByStatus: DashCount[] | null; deliveriesByStatus: DashCount[] | null; modules: string[]
}
export type FinanceDashboard = {
  baseCurrency: string | null; problem: string | null
  kpis: { receivablesOutstanding: number; receivablesOverdue: number; payablesOutstanding: number; payablesOverdue: number; invoicedThisMonth: number; collectedThisMonth: number; billedThisMonth: number; draftInvoices: number; overdueInvoices: number } | null
  agingCounts: DashCount[] | null; receivableAging: DashMoney[] | null; payableAging: DashMoney[] | null; monthly: DashSeries | null
  topDebtors: { code: string; name: string; outstanding: number; overdue: number; invoices: number }[] | null
}

const zone = () => `timezoneOffsetMinutes=${new Date().getTimezoneOffset()}`
export const dashboardsApi = {
  sales: () => request<SalesDashboard>(`/api/dashboards/sales?${zone()}`),
  operations: () => request<OperationsDashboard>(`/api/dashboards/operations?${zone()}`),
  finance: () => request<FinanceDashboard>(`/api/dashboards/finance?${zone()}`),
}
