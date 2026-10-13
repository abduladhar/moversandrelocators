import { CreateCustomerButton } from './CreateCustomerButton'
import { useState } from 'react'
import { Form, Select, message } from 'antd'
import { request } from '../api'
import type { BusinessMaster } from '../businessMasters'
import { useT } from '../i18n'

/** Copies master details into the transaction; saved transaction details remain independent. */
export function ContactMasterPicker({ kind, onSelect, getCreateDefaults, onCreated }: { getCreateDefaults?: () => Partial<BusinessMaster>; onCreated?: (record: BusinessMaster) => void; kind: 'customer' | 'vendor'; onSelect: (record: BusinessMaster) => void }) {
  const { t } = useT()
  const [rows, setRows] = useState<BusinessMaster[]>([]), [loading, setLoading] = useState(false)
  const load = async () => {
    setLoading(true)
    try { setRows(await request<BusinessMaster[]>(`/api/business-masters/${kind}/choices`)) }
    catch (error) { message.error(error instanceof Error ? error.message : t('masters.picker.loadFailed')) }
    finally { setLoading(false) }
  }
  return <><Form.Item label={t(`masters.picker.${kind}.label`)} extra={t(`masters.picker.${kind}.help`)}>
    <Select showSearch value={null} loading={loading} optionFilterProp="label" placeholder={t(`masters.picker.${kind}.placeholder`)}
      onOpenChange={open => { if (open) void load() }}
      notFoundContent={loading ? t('common.loading') : t(`masters.picker.${kind}.empty`)}
      options={rows.map(row => ({ value: row.code, label: `${row.name} · ${row.code}${row.phone ? ` · ${row.phone}` : ''}` }))}
      onChange={code => { const row = rows.find(x => x.code === code); if (row) onSelect(row) }} />
  </Form.Item>{kind === 'customer' && getCreateDefaults && <div style={{ marginBottom: 16 }}><CreateCustomerButton getDefaults={getCreateDefaults} onCreated={row => { setRows(all => [...all, row]); (onCreated ?? onSelect)(row) }} /></div>}</>
}

