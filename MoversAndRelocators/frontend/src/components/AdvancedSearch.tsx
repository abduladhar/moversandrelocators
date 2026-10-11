import { ReactNode, useState } from 'react'
import { Badge, Button, Input, Modal, Select, Space, Typography } from 'antd'
import { FilterOutlined, SearchOutlined } from '@ant-design/icons'

type Props = {
  value: string
  onChange: (value: string) => void
  onReset: () => void
  placeholder?: string
  children?: ReactNode
  active?: boolean
  sortOptions?: { value: string; label: string }[]
  sortField?: string
  onSortField?: (value: string) => void
  sortDirection?: 'asc' | 'desc'
  onSortDirection?: (value: 'asc' | 'desc') => void
}

export function AdvancedSearch({ value, onChange, onReset, placeholder = 'Search records…', children, active, sortOptions, sortField, onSortField, sortDirection, onSortDirection }: Props) {
  const [open, setOpen] = useState(false)
  return <>
    <Badge dot={Boolean(active || value)}><Button icon={<FilterOutlined />} onClick={() => setOpen(true)}>Advanced search</Button></Badge>
    <Modal centered className="filter-modal" title="Advanced search" open={open} onCancel={() => setOpen(false)} footer={<Space><Button onClick={() => { onReset(); setOpen(false) }}>Reset filters</Button><Button type="primary" onClick={() => setOpen(false)}>Show results</Button></Space>}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}><div><Typography.Text strong>Keyword search</Typography.Text><Input allowClear prefix={<SearchOutlined />} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} style={{ marginTop: 8 }} /></div>{children && <div><Typography.Text strong>Filter records</Typography.Text><div className="advanced-fields">{children}</div></div>}{sortOptions && <div><Typography.Text strong>Sort results</Typography.Text><div className="advanced-fields"><Select showSearch optionFilterProp="label" value={sortField} onChange={onSortField} placeholder="Sort by" options={sortOptions} /><Select showSearch optionFilterProp="label" value={sortDirection} onChange={onSortDirection} placeholder="Sort direction" options={[{ value: 'asc', label: 'Ascending' }, { value: 'desc', label: 'Descending' }]} /></div></div>}</Space>
    </Modal>
  </>
}
