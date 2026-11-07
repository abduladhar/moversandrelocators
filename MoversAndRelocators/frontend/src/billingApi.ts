import { request } from './api'
import { createContext, useContext } from 'react'
export const BillingPermissions = createContext<string[]>([])
export const useBilling = () => useContext(BillingPermissions).includes('billing.view')
export type Account = { code: string; name: string; type: string; isActive: boolean; isCashBank: boolean }
/** An operation invoices and charges can belong to, with the customer it records (a code for warehouse receipts, otherwise a name). */
export type Source = { kind: string; id: string; label: string; customerCode?: string | null; customerName?: string | null }
export type Charge = { sourceKind: string; sourceId: string; sourceLabel: string; direction: string; partyCode: string; partyName: string; description: string; accountCode: string; currency: string; fx?: import("./currency").Fx; baseAmount?: number; amount: number; documentId?: string; cancelled: boolean }
export type Line = { chargeId: string; sourceKind: string; sourceId: string; sourceLabel: string; description: string; accountCode: string; amount: number; quantity?:number; unitPrice?:number }
export type Doc = { fx?: import("./currency").Fx; baseAmount?: number; type: string; partyCode: string; partyName: string; address?: string; currency: string; date: string; dueDate: string; reference?: string; notes?: string; amount: number; lines: Line[]; voided: boolean; voidReason?: string }
export type Allocation = { documentId: string; version: string; amount: number; paymentAmount?:number; baseAmount?:number }
export type Voucher = { fx?: import("./currency").Fx; baseAmount?: number; type: string; partyCode: string; partyName: string; currency: string; date: string; accountCode: string; reference: string; notes?: string; amount: number; allocations: Allocation[]; voided: boolean; voidReason?: string }
export type Row<T> = { id: string; number: string; version: string; journalId?: string; details: T }
/** paid and balance count posted payments only; unpostedPaid is allocated by draft payments still waiting to be posted. */
export type DocumentRow = Row<Doc> & { paid: number; balance: number; unpostedPaid: number }
export type Party = { code: string; name: string; isActive: boolean; currency?: string }
export type MappedCharge = { id: string; code: string; name: string; defaultRate: number; isActive: boolean; incomeAccount?: string; expenseAccount?: string }
export type Choices = { chargeMasters: MappedCharge[]; accounts: Account[]; sources: Source[]; customers: Party[]; vendors: Party[] }
/**
 * The customer master an operation belongs to: the one it records by code, else the only active customer with the
 * same name. Undefined when there is none (or several share the name), so the user picks one.
 */
export const sourceCustomer = (source: Source | undefined, customers: Party[]) => {
  if (!source) return undefined
  const active = customers.filter(c => c.isActive)
  const byCode = source.customerCode ? active.find(c => c.code === source.customerCode) : undefined
  if (byCode) return byCode
  const name = source.customerName?.trim().toLowerCase()
  const matches = name ? active.filter(c => c.name.trim().toLowerCase() === name) : []
  return matches.length === 1 ? matches[0] : undefined
}
export const billingApi = {
 choices: () => request<Choices>('/api/billing/choices'),
 charges: () => request<Row<Charge>[]>('/api/billing/charges'),
 documents: () => request<DocumentRow[]>('/api/billing/documents'),
 vouchers: () => request<Row<Voucher>[]>('/api/billing/vouchers'),
 save: <T = unknown>(path: string, input: unknown) => request<T>('/api/billing/'+path,{method:'POST',body:JSON.stringify(input)}),
}

export type CashRow = {id:string;number:string;version:string;posted:boolean;postingNumber?:string;journalId?:string;details:{sourceKind:string;sourceId:string;sourceLabel:string;type:string;partyCode?:string;partyName:string;amount:number;currency:string;fx?:import("./currency").Fx;baseAmount?:number;date:string;reference:string;chargeMasterId?:string;notes?:string}}




