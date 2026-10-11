import { request, downloadFile } from './api'

export interface PickupChoice { id: string; pickupNumber: string; customerName: string }
export interface EmployeeChoice { id: string; fullName: string; isActive: boolean }
export interface VehicleChoice { id: string; registrationNumber: string; name: string; isActive: boolean }
export interface LabourEntry { id: string; pickupId: string; employeeId: string; employeeName: string; activity: string; startedAtUtc: string; endedAtUtc: string; regularHours: number; overtimeHours: number; hourlyRate: number; cost: number; currency: string }
export interface Expense { id: string; pickupId: string; category: string; vendor: string; reference: string; amount: number; currency: string }
export interface CostRow { pickupId: string; pickupNumber: string; customerName: string; currency: string; recordedIncome: number; labourHours: number; labourCost: number; materialCost: number; fuelCost: number; transportOtherCost: number; vendorCost: number; otherExpense: number; legacyExpense: number; totalCost: number; recordedSurplus: number; [key: string]: string | number }
export interface Report { id: string; name: string; columns: string[]; sortBy: string; version: string }
export interface Journal { entry: { id: string; reference: string; description: string; currency: string; postingDate: string; reversesId: string | null }; lines: { accountCode: string; debit: number; credit: number }[] }
export interface Balance { code: string; name: string; debit: number; credit: number; balance: number }
export interface Catalogue { activities: string[]; expenseCategories: string[]; reportColumns: string[]; accounts: { code: string; name: string; kind: string }[] }
export interface Trip { trip: { id: string; number: string; vehicleNumber: string; origin: string; destination: string; startedAtUtc: string; startOdometer: number; endOdometer: number | null; kilometres: number; fuelCost: number; otherCost: number; currency: string; status: string; version: string }; allocations: { pickupId: string; weight: number; fuelCost: number; otherCost: number }[] }
const base = '/api/operations-costs'
const post = <T,>(url: string, value: unknown) => request<T>(url, { method: 'POST', body: JSON.stringify(value) })
export const operationsApi = {
  choices: () => request<{ pickups: PickupChoice[]; employees: EmployeeChoice[]; vehicles: VehicleChoice[] }>(base + '/choices'),
  tripChoices: () => request<{ pickups: PickupChoice[]; vehicles: VehicleChoice[] }>('/api/transport-trips/choices'),
  catalogue: () => request<Catalogue>(base + '/catalogue'),
  costs: (mode='TRANSACTION',date='') => request<CostRow[]>(base + '/summary?'+new URLSearchParams({mode,...(date?{date}:{})})),
  labour: () => request<LabourEntry[]>(base + '/labour'),
  saveLabour: (value: unknown) => post<LabourEntry>(base + '/labour', value),
  expenses: () => request<Expense[]>(base + '/expenses'),
  saveExpense: (value: unknown) => post<Expense>(base + '/expenses', value),
  reports: () => request<Report[]>(base + '/reports'),
  saveReport: (value: unknown, id?: string) => request<Report>(base + '/reports' + (id ? '/' + id : ''), { method: id ? 'PUT' : 'POST', body: JSON.stringify(value) }),
  exportReport: (id: string,mode='TRANSACTION',date='') => downloadFile(base + '/reports/' + id + '/csv?'+new URLSearchParams({mode,...(date?{date}:{})}), 'move-costs.csv'),
  journals: () => request<Journal[]>(base + '/journals'),
  journal: (value: unknown) => post<Journal>(base + '/journals', value),
  reverse: (id: string, value: unknown) => post<Journal>(base + '/journals/' + id + '/reverse', value),
  balance: (currency: string) => request<Balance[]>(base + '/trial-balance?currency=' + encodeURIComponent(currency)),
  trips: () => request<Trip[]>('/api/transport-trips'),
  trip: (value: unknown) => post<Trip>('/api/transport-trips', value),
  completeTrip: (id: string, value: unknown) => post<Trip>('/api/transport-trips/' + id + '/complete', value),
}
export const readable = (value: string) => value.replace(/([A-Z])/g, ' $1').replaceAll('_', ' ').toLowerCase().replace(/^./, c => c.toUpperCase())

/** Where a box or a job is, in the crew's words. One map, so no two screens name the same state differently. */
export const movementLabel = (value: string): string => ({
  DRAFT: 'Draft', PACKED: 'Packed', LOADING: 'Loading', WAREHOUSE: 'In warehouse',
  IN_TRANSIT: 'Transporting', ARRIVED: 'Arrived at destination', DELIVERED: 'Delivered', CANCELLED: 'Cancelled',
} as Record<string, string>)[value] ?? readable(value)

