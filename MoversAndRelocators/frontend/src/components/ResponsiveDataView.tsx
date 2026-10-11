import { DataGrid as Table } from './DataGrid'
import type { ReactNode, UIEvent } from 'react'
import { Card, Empty, Grid, List, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { TableProps } from 'antd'

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
}

export function ResponsiveDataView<T extends object>({ columns, data, rowKey, onScroll, hasMore, total, label, renderTile, onChange, scrollX }: Props<T>) {
  const screens = Grid.useBreakpoint()
  const footer = hasMore ? `Scroll to load more ${label}` : `Showing all ${total} ${label}`
  const gridColumns = columns.map(column => ('title' in column && column.title === 'Actions' && 'render' in column) ? { ...column, width: 80 } : column)
  if (screens.xl) return <Table size="small" tableLayout="auto" rowKey={rowKey} columns={gridColumns} dataSource={data} pagination={false} scroll={{ x: scrollX ?? 'max-content', y: 'calc(100vh - 360px)' }} onScroll={onScroll} onChange={onChange} footer={() => footer} />
  return <div className="tile-scroll" onScroll={onScroll}>{data.length ? <List grid={{ gutter: 12, xs: 1, sm: 2, md: 2 }} dataSource={data} renderItem={item => <List.Item><Card size="small" className="record-tile">{renderTile(item)}</Card></List.Item>} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />}<Typography.Text type="secondary" className="tile-footer">{footer}</Typography.Text></div>
}
