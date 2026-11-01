import { DataGrid as Table } from './DataGrid'
import type { KeyboardEvent, MouseEvent, ReactNode, UIEvent } from 'react'
import { Card, Empty, Grid, List, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { TableProps } from 'antd'
import { useT } from '../i18n'

type Props<T extends object> = {
  columns: ColumnsType<T>
  data: T[]
  rowKey: TableProps<T>['rowKey']
  onScroll: (event: UIEvent<HTMLElement>) => void
  hasMore: boolean
  total: number
  label: string
  renderTile: (item: T) => ReactNode
  scrollX?: number
  onChange?: TableProps<T>['onChange']
  /** A server list is fetching (useServerList). Passing it marks the rows as one server page, which turns off the grid's per-column filters. */
  loading?: boolean
  /** Opens a record when its row or tile is clicked (or Enter is pressed on it). */
  onOpen?: (item: T) => void
}

/** A click inside a control (button, link, input, menu, popup) is that control's own action, not "open the row". */
const insideControl = (target: EventTarget | null) => target instanceof Element && !!target.closest('button, a, input, textarea, select, label, [role="button"], [role="menuitem"], .ant-select, .ant-checkbox, .ant-switch, .ant-dropdown, .ant-popover, .ant-modal')

export function ResponsiveDataView<T extends object>({ columns, data, rowKey, onScroll, hasMore, total, label, renderTile, onChange, scrollX, loading, onOpen }: Props<T>) {
  const { t } = useT()
  const screens = Grid.useBreakpoint()
  const footer = hasMore ? t('shell.dataView.scrollMore', { label }) : t('shell.dataView.showingAll', { total, label })
  const gridColumns = columns.map(column => ('title' in column && (column.title === 'Actions' || column.title === t('common.actions')) && 'render' in column) ? { ...column, width: 80 } : column)
  // The whole row (or tile) opens the record; Enter does the same for keyboard users.
  const openProps = (item: T) => onOpen ? {
    className: 'is-openable', tabIndex: 0,
    onClick: (e: MouseEvent<HTMLElement>) => { if (!insideControl(e.target) && !window.getSelection()?.toString()) onOpen(item) },
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => { if (e.key === 'Enter' && e.target === e.currentTarget) { e.preventDefault(); onOpen(item) } },
  } : {}
  if (screens.xl) return <Table serverPaged={loading !== undefined} size="small" tableLayout="auto" rowKey={rowKey} columns={gridColumns} dataSource={data} loading={loading} pagination={false} scroll={{ x: scrollX ?? 'max-content', y: 'calc(100vh - 360px)' }} onScroll={onScroll} onChange={onChange} footer={() => footer} onRow={openProps} />
  return <div className="tile-scroll" onScroll={onScroll}>{data.length ? <List grid={{ gutter: 12, xs: 1, sm: 2, md: 2 }} dataSource={data} renderItem={item => { const open = openProps(item); return <List.Item><Card size="small" {...open} className={['record-tile', open.className].filter(Boolean).join(' ')}>{renderTile(item)}</Card></List.Item> }} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />}<Typography.Text type="secondary" className="tile-footer">{footer}</Typography.Text></div>
}
