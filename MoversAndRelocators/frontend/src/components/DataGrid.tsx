import { Children, isValidElement, useState, type ReactNode } from 'react'
import { Button, Input, Space, Table } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import type { TableProps } from 'antd'
import type { ColumnsType, ColumnType } from 'antd/es/table'
import type { FilterValue } from 'antd/es/table/interface'

export const isAmount = (text: string) => /amount|cost|price|rate|total|subtotal|discount|debit|credit|balance|expense|revenue|fuelcharges|vendorcharges/i.test(text) && !/count|quantity|hours|minutes|percent|kilomet|distance/i.test(text)

function nodeText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  return Children.toArray(node).map(child => isValidElement<{ children?: ReactNode }>(child) ? nodeText(child.props.children) : typeof child === 'string' || typeof child === 'number' ? String(child) : '').join(' ')
}
function valueAt(row: object, index: unknown): unknown {
  const keys = Array.isArray(index) ? index : [index]
  return keys.reduce<unknown>((value, key) => value != null && key != null ? (value as Record<string, unknown>)[String(key)] : undefined, row)
}
function columnText<T extends object>(column: ColumnType<T>, row: T): string {
  const value = valueAt(row, column.dataIndex)
  if (column.render) {
    try {
      const rendered = nodeText(column.render(value, row, 0) as ReactNode)
      if (rendered.trim()) return rendered
    } catch { /* Fall back to the underlying value. */ }
  }
  return value == null ? '' : typeof value === 'boolean' ? (value ? 'Active Yes' : 'Inactive No') : String(value)
}

export function DataGrid<T extends object>(props: TableProps<T>) {
  const [filters, setFilters] = useState<Record<string, FilterValue | null>>({})
  const [matched, setMatched] = useState<number | null>(null)
  const enhance = (columns: ColumnsType<T>): ColumnsType<T> => columns.map((column, index) => {
    if ('children' in column) return { ...column, children: enhance(column.children) }
    const title = nodeText(typeof column.title === 'function' ? '' : column.title)
    const action = /^actions?$/i.test(title) || column.key === 'actions' || (!title && !column.dataIndex)
    const money = !action && isAmount(title + ' ' + String(column.dataIndex ?? ''))
    const base: ColumnType<T> = { ...column, key: column.key ?? String(column.dataIndex ?? title ?? index),
      align: money ? 'right' : 'left', className: [column.className, money ? 'amount-column' : 'text-column'].filter(Boolean).join(' ') }
    if (action || column.filters || column.filterDropdown) return base
    return { ...base, filteredValue: filters[String(base.key)] ?? null, filterIcon: (filtered: boolean) => <SearchOutlined style={{ color: filtered ? '#247452' : undefined }} />,
      filterDropdown: ({ selectedKeys, setSelectedKeys, confirm, clearFilters }) => <div className="grid-column-filter" onKeyDown={e => e.stopPropagation()}>
        <Input aria-label={'Filter ' + title} placeholder={'Filter ' + title} value={String(selectedKeys[0] ?? '')}
          onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])} onPressEnter={() => confirm()} />
        <Space><Button size="small" type="primary" onClick={() => confirm()}>Apply</Button>
          <Button size="small" onClick={() => { clearFilters?.(); confirm(); }}>Reset</Button></Space>
      </div>,
      onFilter: (value, row) => columnText(column, row).toLocaleLowerCase().includes(String(value).trim().toLocaleLowerCase()) }
  })
  // Grids always fit the page width: drop horizontal scrolling and let cells wrap instead. Fixed layout only where
  // a scrolling body needs header and body columns aligned; otherwise columns size to their content.
  const { x: _x, ...scroll } = props.scroll ?? {}
  return <Table {...props} className={['fit-grid', props.className].filter(Boolean).join(' ')} tableLayout={scroll.y ? 'fixed' : 'auto'} scroll={Object.keys(scroll).length ? scroll : undefined} columns={enhance(props.columns ?? [])} onChange={(pagination, nextFilters, sorter, extra) => { setFilters(nextFilters); setMatched(Object.values(nextFilters).some(value => value?.length) ? extra.currentDataSource.length : null); props.onChange?.(pagination, nextFilters, sorter, extra) }} footer={props.footer && matched !== null ? () => `${matched} matching records in loaded data` : props.footer} />
}

