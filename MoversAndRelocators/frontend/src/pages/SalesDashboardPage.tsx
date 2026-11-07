import { useContext, useEffect, useState } from 'react'
import { Alert, Skeleton } from 'antd'
import { CalendarOutlined, ClockCircleOutlined, FileDoneOutlined, FileSearchOutlined, RiseOutlined, UserAddOutlined } from '@ant-design/icons'
import { dashboardsApi, type SalesDashboard } from '../dashboardsApi'
import { PageHeader } from '../components/PageHeader'
import { BarList, ChartCard, ColumnChart, ItemList, StatTile, vizSeries } from '../components/dashboard/DashboardKit'
import { OpenListContext } from '../searchHandoff'
import { formatDate, formatDateTime, formatNumber, useT } from '../i18n'

/** Sales & planning dashboard: leads, follow-ups, surveys and quotations for the whole company. Rows and tiles open the records. */
export function SalesDashboardPage() {
  const { t } = useT()
  const openList = useContext(OpenListContext)
  const [data, setData] = useState<SalesDashboard>(), [error, setError] = useState<string>()
  const load = () => { setError(undefined); return dashboardsApi.sales().then(setData).catch(e => setError(e instanceof Error ? e.message : t('dashboards.loadFailed'))) }
  useEffect(() => { void load() }, [])
  const label = (ns: string, code: string | null, fallback: string) => code && t(`${ns}.${code}`) !== `${ns}.${code}` ? t(`${ns}.${code}`) : fallback
  const leads = data?.leads, surveys = data?.surveys, quotes = data?.quotations
  const delta = leads ? leads.newLeadsThisMonth - leads.newLeadsLastMonth : 0
  const rate = quotes && quotes.decided90Days ? Math.round(quotes.accepted90Days / quotes.decided90Days * 100) : null
  const weeks = data?.leadsPerWeek?.points.map(p => ({ label: formatDate(p.start, { day: 'numeric', month: 'short' }), values: p.values })) ?? []

  return <>
    <PageHeader onRefresh={load} eyebrow={t('shell.nav.sections.salesPlanning')} title={t('dashboards.sales.title')} description={t('dashboards.sales.description')} />
    {error && <Alert type="error" showIcon title={error} />}
    {!data ? !error && <Skeleton active paragraph={{ rows: 10 }} /> : <div className="dash">
      <div className="dash-tiles">
        {leads && <StatTile icon={<UserAddOutlined />} label={t('dashboards.sales.newLeads')} value={formatNumber(leads.newLeadsThisMonth)} onOpen={() => openList('sales', '')}
          note={delta === 0 ? t('dashboards.sales.sameAsLastMonth') : t(delta > 0 ? 'dashboards.sales.moreThanLastMonth' : 'dashboards.sales.fewerThanLastMonth', { count: Math.abs(delta) })} />}
        {leads && <StatTile label={t('dashboards.sales.openLeads')} value={formatNumber(leads.openLeads)} onOpen={() => openList('sales', '')} />}
        {leads && <StatTile icon={<ClockCircleOutlined />} label={t('dashboards.sales.followUpsOverdue')} value={formatNumber(leads.followUpsOverdue)} tone={leads.followUpsOverdue ? 'attention' : undefined}
          note={t('dashboards.sales.dueToday', { count: leads.followUpsDueToday })} onOpen={() => openList('dashboard', '')} />}
        {surveys && <StatTile icon={<CalendarOutlined />} label={t('dashboards.sales.surveysNext7')} value={formatNumber(surveys.scheduledNext7Days)} onOpen={() => openList('surveys', '')}
          note={surveys.overdue ? t('dashboards.sales.surveysOverdue', { count: surveys.overdue }) : t('dashboards.sales.surveysDone', { count: surveys.completedThisMonth })} tone={surveys.overdue ? 'attention' : undefined} />}
        {quotes && <StatTile icon={<FileDoneOutlined />} label={t('dashboards.sales.awaitingAnswer')} value={formatNumber(quotes.awaitingAnswer)} onOpen={() => openList('quotations', '')}
          note={t('dashboards.sales.sentThisMonth', { count: quotes.sentThisMonth })} />}
        {quotes && <StatTile icon={<RiseOutlined />} label={t('dashboards.sales.acceptanceRate')} value={rate === null ? '—' : `${rate}%`}
          note={t('dashboards.sales.acceptedOf', { accepted: quotes.accepted90Days, decided: quotes.decided90Days })} />}
      </div>

      {leads && <div className="dash-row is-wide-left">
        <ChartCard title={t('dashboards.sales.leadsPerWeek')} subtitle={t('dashboards.sales.last12Weeks')} empty={!weeks.some(w => w.values[0] > 0)}
          columns={[{ key: 'week', title: t('dashboards.weekOf') }, { key: 'count', title: t('dashboards.sales.leads'), align: 'right' }]}
          rows={weeks.map(w => ({ week: w.label, count: w.values[0] }))}>
          <ColumnChart label={t('dashboards.sales.leadsPerWeek')} points={weeks} series={[{ label: t('dashboards.sales.leads'), color: vizSeries[0] }]} format={v => formatNumber(v)} />
        </ChartCard>
        <ChartCard title={t('dashboards.sales.pipeline')} subtitle={t('dashboards.sales.activeLeads')} empty={!data.leadsByStatus?.length}
          columns={[{ key: 'label', title: t('dashboards.status') }, { key: 'count', title: t('dashboards.sales.leads'), align: 'right' }]} rows={data.leadsByStatus ?? []}>
          <BarList keepOrder rows={(data.leadsByStatus ?? []).map(s => ({ label: s.label, value: s.count }))} onOpen={label => openList('sales', label)} />
        </ChartCard>
      </div>}

      <div className="dash-row">
        {leads && <ChartCard title={t('dashboards.sales.bySource')} subtitle={t('dashboards.last90Days')} empty={!data.leadsBySource?.length}
          columns={[{ key: 'label', title: t('dashboards.sales.source') }, { key: 'count', title: t('dashboards.sales.leads'), align: 'right' }]}
          rows={(data.leadsBySource ?? []).map(s => ({ label: label('dashboards.special', s.code, s.label), count: s.count }))}>
          <BarList rows={(data.leadsBySource ?? []).map(s => ({ label: label('dashboards.special', s.code, s.label), value: s.count }))} />
        </ChartCard>}
        {quotes && <ChartCard title={t('dashboards.sales.quotationOutcomes')} subtitle={t('dashboards.last90Days')} empty={!data.quotationOutcomes?.length}
          columns={[{ key: 'label', title: t('dashboards.status') }, { key: 'count', title: t('dashboards.sales.quotations'), align: 'right' }]}
          rows={(data.quotationOutcomes ?? []).map(s => ({ label: label('quotations.status', s.code, s.label), count: s.count }))}>
          <BarList keepOrder rows={(data.quotationOutcomes ?? []).map(s => ({ label: label('quotations.status', s.code, s.label), value: s.count }))} />
          {quotes.acceptedValueThisMonth.length > 0 && <p className="dash-footnote">{t('dashboards.sales.acceptedValue')} {quotes.acceptedValueThisMonth.map(m => `${m.currency} ${formatNumber(m.amount, { maximumFractionDigits: 0 })}`).join(' · ')}</p>}
        </ChartCard>}
      </div>

      <div className="dash-row">
        {surveys && <ChartCard title={t('dashboards.sales.upcomingSurveys')} subtitle={t('dashboards.next7Days')}>
          <ItemList empty={t('dashboards.sales.noUpcomingSurveys')} items={(data.upcomingSurveys ?? []).map(s => ({ key: s.id, title: s.customer, onOpen: () => openList('surveys', s.number),
            meta: [s.number, s.detail, s.person].filter(Boolean).join(' · '), side: <span className="dash-when"><FileSearchOutlined /> {formatDateTime(s.atUtc)}</span> }))} />
        </ChartCard>}
        {leads && <ChartCard title={t('dashboards.sales.recentLeads')}>
          <ItemList empty={t('dashboards.sales.noLeads')} items={(data.recentLeads ?? []).map(l => ({ key: l.id, title: l.customer, onOpen: () => openList('sales', l.number),
            meta: [l.number, l.detail, l.status].filter(Boolean).join(' · '), side: <span className="dash-when">{formatDate(l.atUtc)}</span> }))} />
        </ChartCard>}
      </div>
      {!leads && !surveys && !quotes && <Alert type="info" showIcon title={t('dashboards.noAccess')} />}
    </div>}
  </>
}
