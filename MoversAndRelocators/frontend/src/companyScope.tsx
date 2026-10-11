import { useCallback, useEffect, useState } from 'react'
import { Modal, Select, message } from 'antd'
import { request } from './api'

/** Master kinds that can be shared by every company or kept to one (matches api/master-scopes/{kind}). */
export type ScopeKind = 'customer' | 'vendor' | 'crew-role' | 'payment-method' | 'payment-purpose' | 'expense-category' | 'employee' | 'designation' | 'team'
  | 'lead-status' | 'follow-up-status' | 'move-type' | 'household-item' | 'packing-material' | 'box-type' | 'charge' | 'tax' | 'pickup-status' | 'vehicle' | 'warehouse'

type Scopes = { enabled: boolean; companyName: string | null; companyOnly: string[] }

export const masterScopesApi = {
  get: (kind: ScopeKind) => request<Scopes>(`/api/master-scopes/${kind}`),
  set: (kind: ScopeKind, key: string, companyOnly: boolean) => request<void>(`/api/master-scopes/${kind}/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify({ companyOnly }) }),
}

/**
 * Shared or company-only masters. Records are shared by every company of the tenant unless marked for the current
 * company. column() adds an "Available in" column to a master table; it is empty while the tenant has one company.
 */
export function useCompanyScopes(kind: ScopeKind) {
  const [scopes, setScopes] = useState<Scopes>({ enabled: false, companyName: null, companyOnly: [] })
  const load = useCallback(() => masterScopesApi.get(kind).then(setScopes).catch(() => setScopes({ enabled: false, companyName: null, companyOnly: [] })), [kind])
  useEffect(() => { void load() }, [load])
  const isCompanyOnly = (key: string) => scopes.companyOnly.includes(key)

  const set = async (key: string, companyOnly: boolean) => {
    try {
      await masterScopesApi.set(kind, key, companyOnly)
      setScopes(s => ({ ...s, companyOnly: companyOnly ? [...s.companyOnly.filter(x => x !== key), key] : s.companyOnly.filter(x => x !== key) }))
      message.success(companyOnly ? `Now only in ${scopes.companyName ?? 'this company'}` : 'Now shared with all companies')
    } catch (reason) { message.error(reason instanceof Error ? reason.message : 'Unable to change where this record is available') }
  }

  const change = (key: string, companyOnly: boolean) => {
    if (!companyOnly) { void set(key, false); return }
    Modal.confirm({
      title: `Keep this record to ${scopes.companyName ?? 'this company'} only?`,
      content: 'Other companies will no longer see or pick it. Documents they already made with it are not changed.',
      okText: 'Keep to this company',
      onOk: () => set(key, true),
    })
  }

  /** The "Available in" selector for one record. */
  const control = (key: string) => <Select size="small" className="company-scope-select" value={isCompanyOnly(key) ? 'company' : 'all'} popupMatchSelectWidth={false}
    onChange={value => change(key, value === 'company')} onClick={event => event.stopPropagation()}
    options={[{ value: 'all', label: 'All companies' }, { value: 'company', label: `${scopes.companyName ?? 'This company'} only` }]} />

  /** Column definition for antd tables (an empty list while the tenant has a single company). */
  const column = <T,>(keyOf: (row: T) => string) => scopes.enabled
    ? [{ title: 'Available in', key: 'company-scope', width: 190, render: (_: unknown, row: T) => control(keyOf(row)) }]
    : []

  return { ...scopes, isCompanyOnly, set, change, control, column, reload: load }
}
