import { useContext, useEffect, useState } from 'react'
import { Alert, Button, Skeleton } from 'antd'
import { BankOutlined, ClockCircleOutlined, FileTextOutlined, FundOutlined, WalletOutlined } from '@ant-design/icons'
import { dashboardsApi, type FinanceDashboard } from '../dashboardsApi'
import { PageHeader } from '../components/PageHeader'
import { BarList, ChartCard, ColumnChart, ItemList, Legend, StatTile, compact, vizRamp, vizSeries } from '../components/dashboard/DashboardKit'
import { OpenListContext } from '../searchHandoff'
import { formatDate, formatNumber, useT } from '../i18n'

/**
 * Finance dashboard, in the base currency: what customers owe and how late, what is owed to vendors, invoicing and
 * collections over six months, and the largest debtors. Figures come from the accounting reports, so they match them.
 */
export function FinanceDashboardPage() {
  const { t } = useT()
  const openList = useContext(OpenListContext)
  const [data, setData] = useState<FinanceDashboard>(), [error, setError] = useState<string>()
  const load = () => { setError(undefined); return dashboardsApi.finance().then(setData).catch(e => setError(e instanceof Error ? e.message : t('dashboards.loadFailed'))) }
  useEffect(() => { void load() }, [])
  const cur = data?.baseCurrency ?? ''
  const money = (v: number) => `${cur} ${formatNumber(v, { maximumFractionDigits: 0 })}`.trim()
  const k = data?.kpis
  const bucket = (code: string) => t(`dashboards.finance.bucket.${code}`)
  const months = data?.monthly?.points.map(p => ({ label: formatDate(p.start, { month: 'short' }), values: p.values })) ?? []
  const pair = [{ label: t('dashboards.finance.invoiced'), color: vizSeries[0] }, { label: t('dashboards.finance.collected'), color: vizSeries[1] }]
  const aging = (rows: FinanceDashboard['receivableAging'], title: string, subtitle: string, list: string) => rows && <ChartCard title={title} subtitle={subtitle}
    empty={!rows.some(r => r.amount)} columns={[{ key: 'label', title: t('dashboards.finance.age') }, { key: 'amount', title: cur, align: 'right', render: r => formatNumber(Number(r.amount), { maximumFractionDigits: 2 }) }]}
    rows={rows.map(r => ({ label: bucket(r.currency), amount: r.amount }))}>
    <BarList keepOrder format={money} rows={rows.map((r, i) => ({ label: bucket(r.currency), value: r.amount, color: vizRamp[i] }))} onOpen={() => openList(list, '')} />
  </ChartCard>

  return <>
    <PageHeader onRefresh={load} eyebrow={t('shell.nav.sections.finance')} title={t('dashboards.finance.title')} description={t('dashboards.finance.description')} />
    {error && <Alert type="error" showIcon title={error} />}
    {!data ? !error && <Skeleton active paragraph={{ rows: 10 }} /> : data.problem || !k ? <Alert type="warning" showIcon title={t('dashboards.finance.notReady')} description={data.problem}
      action={<Button size="small" onClick={() => openList('currency-settings', '')}>{t('dashboards.finance.openCurrency')}</Button>} /> : <div className="dash">
      <p className="dash-footnote">{t('dashboards.finance.inBase', { currency: cur })}</p>
      <div className="dash-tiles">
        <StatTile icon={<WalletOutlined />} label={t('dashboards.finance.receivables')} value={money(k.receivablesOutstanding)} onOpen={() => openList('accounting-reports', '')}
          note={t('dashboards.finance.overdueAmount', { amount: money(k.receivablesOverdue) })} tone={k.receivablesOverdue > 0 ? 'attention' : undefined} />
        <StatTile icon={<BankOutlined />} label={t('dashboards.finance.payables')} value={money(k.payablesOutstanding)} onOpen={() => openList('accounting-reports', '')}
          note={t('dashboards.finance.overdueAmount', { amount: money(k.payablesOverdue) })} />
        <StatTile icon={<FileTextOutlined />} label={t('dashboards.finance.invoicedThisMonth')} value={money(k.invoicedThisMonth)} onOpen={() => openList('billing', '')} />
        <StatTile icon={<FundOutlined />} label={t('dashboards.finance.collectedThisMonth')} value={money(k.collectedThisMonth)} onOpen={() => openList('billing', '')} />
        <StatTile label={t('dashboards.finance.billsThisMonth')} value={money(k.billedThisMonth)} onOpen={() => openList('billing', '')} />
        <StatTile icon={<ClockCircleOutlined />} label={t('dashboards.finance.draftInvoices')} value={formatNumber(k.draftInvoices)} tone={k.draftInvoices ? 'attention' : undefined}
          note={t('dashboards.finance.overdueInvoices', { count: k.overdueInvoices })} onOpen={() => openList('posting', '')} />
      </div>

      <div className="dash-row is-wide-left">
        <ChartCard title={t('dashboards.finance.invoicedVsCollected')} subtitle={t('dashboards.finance.last6Months')} empty={!months.some(m => m.values.some(v => v > 0))} legend={<Legend items={pair} />}
          columns={[{ key: 'month', title: t('dashboards.month') }, { key: 'invoiced', title: pair[0].label, align: 'right', render: r => money(Number(r.invoiced)) }, { key: 'collected', title: pair[1].label, align: 'right', render: r => money(Number(r.collected)) }]}
          rows={months.map(m => ({ month: m.label, invoiced: m.values[0], collected: m.values[1] }))}>
          <ColumnChart mode="grouped" label={t('dashboards.finance.invoicedVsCollected')} points={months} series={pair} format={compact} />
        </ChartCard>
        {aging(data.receivableAging, t('dashboards.finance.receivableAging'), t('dashboards.finance.byDaysOverdue'), 'accounting-reports')}
      </div>

      <div className="dash-row">
        <ChartCard title={t('dashboards.finance.topDebtors')} subtitle={t('dashboards.finance.largestBalances')}>
          <ItemList empty={t('dashboards.finance.noDebtors')} items={(data.topDebtors ?? []).map(d => ({ key: d.code, title: d.name, onOpen: () => openList('customers', d.code),
            meta: [d.code, t('dashboards.finance.invoiceCount', { count: d.invoices }), d.overdue > 0 ? t('dashboards.finance.overdueAmount', { amount: money(d.overdue) }) : null].filter(Boolean).join(' · '),
            side: <span className="dash-amount">{money(d.outstanding)}</span> }))} />
        </ChartCard>
        {aging(data.payableAging, t('dashboards.finance.payableAging'), t('dashboards.finance.byDaysOverdue'), 'accounting-reports')}
      </div>
    </div>}
  </>
}
