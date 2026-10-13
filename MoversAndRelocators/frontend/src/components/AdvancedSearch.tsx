import { ReactNode, useState } from 'react'
import { Badge, Button, Input, Modal, Select, Space, Typography } from 'antd'
import { FilterOutlined, SearchOutlined } from '@ant-design/icons'
import { useT } from '../i18n'

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

export function AdvancedSearch({ value, onChange, onReset, placeholder, children, active, sortOptions, sortField, onSortField, sortDirection, onSortDirection }: Props) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  return <>
    <Badge dot={Boolean(active || value)}><Button icon={<FilterOutlined />} onClick={() => setOpen(true)}>{t('shell.search.advanced')}</Button></Badge>
    <Modal centered className="filter-modal" title={t('shell.search.advanced')} open={open} onCancel={() => setOpen(false)} footer={<Space><Button onClick={() => { onReset(); setOpen(false) }}>{t('shell.search.resetFilters')}</Button><Button type="primary" onClick={() => setOpen(false)}>{t('shell.search.showResults')}</Button></Space>}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}><div><Typography.Text strong>{t('shell.search.keyword')}</Typography.Text><Input allowClear prefix={<SearchOutlined />} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder ?? t('shell.search.placeholder')} style={{ marginTop: 8 }} /></div>{children && <div><Typography.Text strong>{t('shell.search.filterRecords')}</Typography.Text><div className="advanced-fields">{children}</div></div>}{sortOptions && <div><Typography.Text strong>{t('shell.search.sortResults')}</Typography.Text><div className="advanced-fields"><Select showSearch optionFilterProp="label" value={sortField} onChange={onSortField} placeholder={t('shell.search.sortBy')} options={sortOptions} /><Select showSearch optionFilterProp="label" value={sortDirection} onChange={onSortDirection} placeholder={t('shell.search.sortDirection')} options={[{ value: 'asc', label: t('shell.search.ascending') }, { value: 'desc', label: t('shell.search.descending') }]} /></div></div>}</Space>
    </Modal>
  </>
}
