import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Card, Empty, Segmented, Table } from 'antd'
import { BarChartOutlined, TableOutlined } from '@ant-design/icons'
import { formatNumber, useT } from '../../i18n'

/**
 * Building blocks of the module dashboards: stat tiles, a chart card with a table view, a column chart (one series,
 * stacked or grouped), ranked bars and a segmented bar. Colours come from the --viz-* tokens in styles.css; they
 * were checked with the data-viz palette validator (blue / orange / aqua pass every check, including colour blindness).
 */

export const vizSeries = ['var(--viz-1)', 'var(--viz-2)', 'var(--viz-3)']
/** An ordered blue ramp for ordered buckets (e.g. aging: not due → over 120 days), light to dark. */
export const vizRamp = ['var(--viz-ramp-1)', 'var(--viz-ramp-2)', 'var(--viz-ramp-3)', 'var(--viz-ramp-4)', 'var(--viz-ramp-5)', 'var(--viz-ramp-6)']

export const compact = (value: number) => formatNumber(value, Math.abs(value) >= 10000 ? { notation: 'compact', maximumFractionDigits: 1 } : { maximumFractionDigits: 0 })

/** A headline number. tone: 'attention' paints the value (with its label, so colour never stands alone). onOpen: the tile opens the related list. */
export function StatTile({ label, value, note, tone, icon, onOpen }: { label: string; value: ReactNode; note?: ReactNode; tone?: 'attention' | 'good'; icon?: ReactNode; onOpen?: () => void }) {
  const body = <><span className="dash-tile-label">{icon}{label}</span><strong className={`dash-tile-value${tone ? ' is-' + tone : ''}`}>{value}</strong>{note && <span className="dash-tile-note">{note}</span>}</>
  return onOpen ? <button type="button" className="dash-tile is-link" onClick={onOpen}>{body}</button> : <div className="dash-tile">{body}</div>
}

export type TableColumn = { key: string; title: string; align?: 'left' | 'right'; render?: (row: Record<string, unknown>) => ReactNode }
/** A titled card whose chart can be switched to a table of the same numbers (for screen readers, exact values and print). */
export function ChartCard({ title, subtitle, children, columns, rows, empty, legend }: { title: string; subtitle?: string; children: ReactNode; columns?: TableColumn[]; rows?: Record<string, unknown>[]; empty?: boolean; legend?: ReactNode }) {
  const { t } = useT()
  const [view, setView] = useState<'chart' | 'table'>('chart')
  return <Card className="dash-card" title={<div className="dash-card-title"><span>{title}</span>{subtitle && <small>{subtitle}</small>}</div>}
    extra={columns && rows && !empty ? <Segmented size="small" value={view} onChange={v => setView(v as 'chart' | 'table')} options={[
      { value: 'chart', icon: <BarChartOutlined />, title: t('dashboards.chartView') }, { value: 'table', icon: <TableOutlined />, title: t('dashboards.tableView') }]} /> : undefined}>
    {empty ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('dashboards.noData')} />
      : view === 'table' && columns && rows ? <Table size="small" pagination={false} rowKey="__row" dataSource={rows.map((row, i) => ({ ...row, __row: i }))}
        columns={columns.map(c => ({ key: c.key, title: c.title, align: c.align, render: (_: unknown, row: Record<string, unknown>) => c.render ? c.render(row) : String(row[c.key] ?? '') }))} />
      : <>{legend}{children}</>}
  </Card>
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return <ul className="dash-legend">{items.map(i => <li key={i.label}><span className="dash-swatch" style={{ background: i.color }} />{i.label}</li>)}</ul>
}

const niceMax = (value: number) => {
  if (value <= 0) return 4
  const power = 10 ** Math.floor(Math.log10(value)), unit = value / power
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10) * power
}

/**
 * Columns over time or categories. One series = one blue; several = stacked (a 2px surface gap between segments)
 * or grouped side by side. Hovering a column shows all its values. Rounded ends sit at the top only.
 */
export function ColumnChart({ points, series, mode = 'stacked', height = 220, format = compact, label }: {
  points: { label: string; values: number[] }[]; series: { label: string; color: string }[]; mode?: 'stacked' | 'grouped'; height?: number; format?: (v: number) => string; label: string
}) {
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(600), [hover, setHover] = useState<number | null>(null)
  useEffect(() => {
    if (!box.current) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, entry.contentRect.width)))
    observer.observe(box.current); return () => observer.disconnect()
  }, [])
  const pad = { top: 10, right: 8, bottom: 26, left: 44 }
  const plotW = width - pad.left - pad.right, plotH = height - pad.top - pad.bottom
  const totals = points.map(p => mode === 'stacked' ? p.values.reduce((a, b) => a + b, 0) : Math.max(0, ...p.values))
  // Counts get whole-number ticks (0, 2, 4, 6, 8), not 1.25 / 3.75.
  const whole = points.every(p => p.values.every(Number.isInteger))
  const max = whole ? Math.max(4, Math.ceil(niceMax(Math.max(0, ...totals)) / 4) * 4) : niceMax(Math.max(0, ...totals))
  const slot = plotW / Math.max(1, points.length)
  const barW = Math.min(36, slot * 0.62)
  const y = (v: number) => pad.top + plotH - (v / max) * plotH
  const every = Math.ceil(points.length / Math.max(1, Math.floor(plotW / 56)))
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => f * max)
  const top = (x: number, y0: number, w: number, h: number) => { const r = Math.min(4, w / 2, h); return `M${x},${y0 + h}V${y0 + r}Q${x},${y0} ${x + r},${y0}H${x + w - r}Q${x + w},${y0} ${x + w},${y0 + r}V${y0 + h}Z` }
  return <div ref={box} className="dash-columns" onMouseLeave={() => setHover(null)}>
    <svg width={width} height={height} role="img" aria-label={label}>
      {ticks.map(v => <g key={v}><line x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} className="dash-grid" /><text x={pad.left - 6} y={y(v) + 4} className="dash-axis" textAnchor="end">{format(v)}</text></g>)}
      {points.map((p, i) => {
        const cx = pad.left + slot * i + slot / 2
        let base = 0
        return <g key={i} className={hover === i ? 'is-hover' : undefined}>
          {mode === 'stacked' ? p.values.map((v, s) => {
            if (v <= 0) return null
            const y0 = y(base + v), h = y(base) - y0 - (base > 0 ? 2 : 0); base += v
            const last = p.values.slice(s + 1).every(x => x <= 0)
            return last ? <path key={s} d={top(cx - barW / 2, y0, barW, Math.max(1, h))} fill={series[s].color} /> : <rect key={s} x={cx - barW / 2} y={y0} width={barW} height={Math.max(1, h)} fill={series[s].color} />
          }) : p.values.map((v, s) => {
            const w = Math.max(3, (barW - 2 * (p.values.length - 1)) / p.values.length), x = cx - barW / 2 + s * (w + 2)
            return v > 0 ? <path key={s} d={top(x, y(v), w, Math.max(1, y(0) - y(v)))} fill={series[s].color} /> : null
          })}
          {i % every === 0 && <text x={cx} y={height - 8} className="dash-axis" textAnchor="middle">{p.label}</text>}
          <rect x={pad.left + slot * i} y={pad.top} width={slot} height={plotH} fill="transparent" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={-1} />
        </g>
      })}
      <line x1={pad.left} x2={width - pad.right} y1={y(0)} y2={y(0)} className="dash-baseline" />
    </svg>
    {hover !== null && <div className="dash-tooltip" style={{ left: Math.min(width - 170, Math.max(0, pad.left + slot * hover + slot / 2 - 80)) }}>
      <strong>{points[hover].label}</strong>
      {series.map((s, i) => <span key={s.label}><i className="dash-swatch" style={{ background: s.color }} />{s.label}<b>{format(points[hover].values[i] ?? 0)}</b></span>)}
    </div>}
  </div>
}

/** Ranked horizontal bars (largest first unless keepOrder), one hue, value printed at the end. onOpen: a row opens the related list. */
export function BarList({ rows, color = 'var(--viz-1)', format = (v: number) => formatNumber(v), keepOrder, onOpen }: {
  rows: { label: string; value: number; color?: string }[]; color?: string; format?: (v: number) => string; keepOrder?: boolean; onOpen?: (label: string) => void
}) {
  const ordered = useMemo(() => keepOrder ? rows : [...rows].sort((a, b) => b.value - a.value), [rows, keepOrder])
  const max = Math.max(1, ...ordered.map(r => r.value))
  return <ul className="dash-bars">{ordered.map(r => {
    const content = <><span className="dash-bar-label">{r.label}</span><span className="dash-bar-track"><span className="dash-bar-fill" style={{ width: r.value > 0 ? `max(3px, ${(r.value / max) * 100}%)` : 0, background: r.color ?? color }} /></span><span className="dash-bar-value">{format(r.value)}</span></>
    return <li key={r.label}>{onOpen ? <button type="button" onClick={() => onOpen(r.label)} title={`${r.label}: ${format(r.value)}`}>{content}</button> : <div title={`${r.label}: ${format(r.value)}`}>{content}</div>}</li>
  })}</ul>
}

/** One whole split into a few parts, each block labelled with its share where it fits; the legend names the parts. */
export function SegmentedBar({ parts, format = (v: number) => formatNumber(v) }: { parts: { label: string; value: number; color: string }[]; format?: (v: number) => string }) {
  const total = parts.reduce((a, p) => a + p.value, 0)
  if (!total) return null
  return <div className="dash-segmented">
    <div className="dash-segmented-bar" role="img" aria-label={parts.map(p => `${p.label} ${format(p.value)}`).join(', ')}>
      {parts.filter(p => p.value > 0).map(p => <span key={p.label} style={{ flexGrow: p.value, background: p.color }} title={`${p.label}: ${format(p.value)} (${Math.round(p.value / total * 100)}%)`}>
        {p.value / total >= 0.12 && <em>{Math.round(p.value / total * 100)}%</em>}</span>)}
    </div>
    <Legend items={parts.map(p => ({ label: `${p.label} · ${format(p.value)}`, color: p.color }))} />
  </div>
}

/** A short "next up" list: each row opens the record. */
export function ItemList({ items, empty }: { items: { key: string; title: ReactNode; meta: ReactNode; side?: ReactNode; onOpen?: () => void }[]; empty: string }) {
  if (!items.length) return <p className="dash-empty">{empty}</p>
  return <ul className="dash-items">{items.map(i => <li key={i.key}>{i.onOpen
    ? <button type="button" onClick={i.onOpen}><span><strong>{i.title}</strong><small>{i.meta}</small></span>{i.side}</button>
    : <div><span><strong>{i.title}</strong><small>{i.meta}</small></span>{i.side}</div>}</li>)}</ul>
}
