import { useEffect, useState } from 'react'
import { message } from 'antd'
import { request } from './api'
export type MasterKind = 'crew-role' | 'payment-method' | 'payment-purpose' | 'expense-category' | 'customer' | 'vendor'
export type BusinessMaster = { code: string; name: string; isActive: boolean; phone?: string; email?: string; address?: string; contactName?: string; taxReference?: string; notes?: string; vendorType?: string; isAgent?: boolean; currency?: string }
export const businessMastersApi = {
 list: (kind: MasterKind) => request<BusinessMaster[]>(`/api/business-masters/${kind}`),
 save: (kind: MasterKind, value: BusinessMaster, code?: string) => request<BusinessMaster>(`/api/business-masters/${kind}${code ? '/' + encodeURIComponent(code) : ''}`, { method: code ? 'PUT' : 'POST', body: JSON.stringify(value) }),
}
export function useBusinessMasters(kind: MasterKind) {
 const [rows, setRows] = useState<BusinessMaster[]>([])
 const reload = () => businessMastersApi.list(kind).then(setRows).catch(error => message.error(error.message))
 useEffect(() => { void reload() }, [kind])
 return { rows, reload }
}


