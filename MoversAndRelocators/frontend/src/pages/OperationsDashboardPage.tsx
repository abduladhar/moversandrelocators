import { useContext, useEffect, useState } from 'react'
import { Alert, Skeleton, Tag } from 'antd'
import { CarOutlined, ClockCircleOutlined, InboxOutlined, PlayCircleOutlined, ScheduleOutlined, ShopOutlined } from '@ant-design/icons'
import { dashboardsApi, type DashCount, type DashItem, type OperationsDashboard } from '../dashboardsApi'
import { PageHeader } from '../components/PageHeader'
import { BarList, ChartCard, ColumnChart, ItemList, Legend, StatTile, vizSeries } from '../components/dashboard/DashboardKit'
import { OpenListContext } from '../searchHandoff'
import { formatDate, formatNumber, useT } from '../i18n'

const lists: Record<string, string> = { PICKUP: 'pickups', PACKING: 'packing', DELIVERY: 'delivery' }
const colorOf: Record<string, string> = { PICKUP: vizSeries[0], PACKING: vizSeries[1], DELIVERY: vizSeries[2] }

/** Operations dashboard: today's pickups, packing jobs and deliveries, what is running late, the next two weeks and the warehouse. */
export function OperationsDashboardPage() {
  const { t } = useT()
  const openList = useContext(OpenListContext)
  const [data, setData] = useState<OperationsDashboard>(), [error, setError] = useState<string>()
  const load = () => { setError(undefined); return dashboardsApi.operations().then(setData).catch(e => setError(e instanceof Error ? e.message : t('dashboards.loadFailed'))) }
  useEffect(() => { void load() }, [])
  const kind = (k: string) => t(`dashboards.operations.kind.${k}`)
  const status = (k: string, code: string | null, fallback: string) => {
    const ns = k === 'PACKING' ? 'packing.status' : k === 'DELIVERY' ? 'delivery.status' : ''
    return ns && code && t(`${ns}.${code}`) !== `${ns}.${code}` ? t(`${ns}.${code}`) : fallback
  }
  const item = (j: DashItem, when: 'time' | 'date') => ({ key: j.kind + j.id, onOpen: () => openList(lists[j.kind], j.number),
    title: <><Tag className="dash-kind" style={{ borderColor: colorOf[j.kind] }}>{kind(j.kind)}</Tag>{j.customer || j.number}</>,
    meta: [j.customer ? j.number : null, status(j.kind, j.status, j.status ?? ''), j.person, j.detail].filter(Boolean).join(' · '),
    side: <span className="dash-when">{when === 'time' ? formatDate(j.atUtc, { timeStyle: 'short' }) : formatDate(j.atUtc)}</span> })
  const breakdown = (k: string, rows: DashCount[] | null) => rows && <ChartCard key={k} title={t('dashboards.operations.byStatus', { module: kind(k) })} subtitle={t('dashboards.operations.openAndRecent')}
    empty={!rows.length} columns={[{ key: 'label', title: t('dashboards.status') }, { key: 'count', title: t('dashboards.operations.jobs'), align: 'right' }]}
    rows={rows.map(r => ({ label: status(k, r.code, r.label), count: r.count }))}>
    <BarList keepOrder color={colorOf[k]} rows={rows.map(r => ({ label: status(k, r.code, r.label), value: r.count }))} onOpen={() => openList(lists[k], '')} />
  </ChartCard>

  const k = data?.kpis, modules = data?.modules ?? []
  const series = (data?.next14Days.series ?? []).map(s => ({ label: kind(s), color: colorOf[s] }))
  const days = data?.next14Days.points.map(p => ({ label: formatDate(p.start, { weekday: 'short', day: 'numeric' }), values: p.values })) ?? []
  return <>
    <PageHeader onRefresh={load} eyebrow={t('shell.nav.sections.operations')} title={t('dashboards.operations.title')} description={t('dashboards.operations.description')} />
    {error && <Alert type="error" showIcon title={error} />}
    {!data || !k ? !error && <Skeleton active paragraph={{ rows: 10 }} /> : !modules.length ? <Alert type="info" showIcon title={t('dashboards.noAccess')} /> : <div className="dash">
      <div className="dash-tiles">
        {modules.includes('PICKUP') && <StatTile icon={<CarOutlined />} label={t('dashboards.operations.pickupsToday')} value={formatNumber(k.pickupsToday)} onOpen={() => openList('pickups', '')} />}
        {modules.includes('PACKING') && <StatTile icon={<InboxOutlined />} label={t('dashboards.operations.packingToday')} value={formatNumber(k.packingToday)} onOpen={() => openList('packing', '')} />}
        {modules.includes('DELIVERY') && <StatTile icon={<ScheduleOutlined />} label={t('dashboards.operations.deliveriesToday')} value={formatNumber(k.deliveriesToday)} onOpen={() => openList('delivery', '')} />}
        <StatTile icon={<PlayCircleOutlined />} label={t('dashboards.operations.inProgress')} value={formatNumber(k.inProgress)} note={t('dashboards.operations.inProgressNote')} />
        <StatTile icon={<ClockCircleOutlined />} label={t('dashboards.operations.overdue')} value={formatNumber(k.overdue)} tone={k.overdue ? 'attention' : undefined} note={t('dashboards.operations.overdueNote')} />
        {k.boxesInWarehouse !== null && <StatTile icon={<ShopOutlined />} label={t('dashboards.operations.boxesInWarehouse')} value={formatNumber(k.boxesInWarehouse)} note={t('dashboards.operations.boxesNote')} onOpen={() => openList('warehouse', '')} />}
      </div>

      <div className="dash-row is-wide-left">
        <ChartCard title={t('dashboards.operations.next14Days')} subtitle={t('dashboards.operations.scheduledJobs')} empty={!days.some(d => d.values.some(v => v > 0))}
          legend={series.length > 1 ? <Legend items={series} /> : undefined}
          columns={[{ key: 'day', title: t('dashboards.day') }, ...series.map((s, i) => ({ key: 's' + i, title: s.label, align: 'right' as const }))]}
          rows={days.map(d => ({ day: d.label, ...Object.fromEntries(d.values.map((v, i) => ['s' + i, v])) }))}>
          <ColumnChart label={t('dashboards.operations.next14Days')} points={days} series={series} format={v => formatNumber(v)} />
        </ChartCard>
        <ChartCard title={t('dashboards.operations.today')} subtitle={formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}>
          <ItemList empty={t('dashboards.operations.nothingToday')} items={data.today.map(j => item(j, 'time'))} />
        </ChartCard>
      </div>

      <div className="dash-row">
        <ChartCard title={t('dashboards.operations.overdueJobs')} subtitle={t('dashboards.operations.overdueJobsHint')}>
          <ItemList empty={t('dashboards.operations.nothingOverdue')} items={data.overdueJobs.map(j => item(j, 'date'))} />
        </ChartCard>
        <div className="dash-stack">{breakdown('PICKUP', data.pickupsByStatus)}{breakdown('PACKING', data.packingByStatus)}{breakdown('DELIVERY', data.deliveriesByStatus)}</div>
      </div>
    </div>}
  </>
}
