import { useCallback, useEffect, useState } from 'react'
import { Modal, Select, message } from 'antd'
import { request } from './api'
import { useT } from './i18n'

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
export function useCompanyScopes(kind: ScopeKind | null) {
  const { t } = useT()
  const [scopes, setScopes] = useState<Scopes>({ enabled: false, companyName: null, companyOnly: [] })
  const load = useCallback(() => kind === null ? Promise.resolve() : masterScopesApi.get(kind).then(setScopes).catch(() => setScopes({ enabled: false, companyName: null, companyOnly: [] })), [kind])
  useEffect(() => { void load() }, [load])
  const isCompanyOnly = (key: string) => scopes.companyOnly.includes(key)

  const set = async (key: string, companyOnly: boolean) => {
    try {
      if (kind === null) return
      await masterScopesApi.set(kind, key, companyOnly)
      setScopes(s => ({ ...s, companyOnly: companyOnly ? [...s.companyOnly.filter(x => x !== key), key] : s.companyOnly.filter(x => x !== key) }))
      message.success(companyOnly ? t('shell.scope.nowOnlyIn', { company: scopes.companyName ?? t('shell.scope.thisCompany') }) : t('shell.scope.nowShared'))
    } catch (reason) { message.error(reason instanceof Error ? reason.message : t('shell.scope.changeFailed')) }
  }

  const change = (key: string, companyOnly: boolean) => {
    if (!companyOnly) { void set(key, false); return }
    Modal.confirm({
      title: t('shell.scope.keepTitle', { company: scopes.companyName ?? t('shell.scope.thisCompany') }),
      content: t('shell.scope.keepContent'),
      okText: t('shell.scope.keepOk'), cancelText: t('common.cancel'),
      onOk: () => set(key, true),
    })
  }

  /** The "Available in" selector for one record. */
  const control = (key: string) => <Select size="small" className="company-scope-select" value={isCompanyOnly(key) ? 'company' : 'all'} popupMatchSelectWidth={false}
    onChange={value => change(key, value === 'company')} onClick={event => event.stopPropagation()}
    options={[{ value: 'all', label: t('shell.scope.allCompanies') }, { value: 'company', label: scopes.companyName ? t('shell.scope.companyOnly', { company: scopes.companyName }) : t('shell.scope.thisCompanyOnly') }]} />

  /** Column definition for antd tables (an empty list while the tenant has a single company). */
  const column = <T,>(keyOf: (row: T) => string) => scopes.enabled
    ? [{ title: t('shell.scope.availableIn'), key: 'company-scope', width: 190, render: (_: unknown, row: T) => control(keyOf(row)) }]
    : []

  return { ...scopes, isCompanyOnly, set, change, control, column, reload: load }
}
