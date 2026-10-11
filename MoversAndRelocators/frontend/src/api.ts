import type { AuditLog, PickupAttachment, PickupWork, Warehouse, SurveyExpenseInput, CatalogItem, CustomerChangesInput, SurveyAttachment, AuthSession, AwsConfiguration, AwsConfigurationInput, BoxType, ChargeMaster, TaxMaster, Designation, DesignationInput, Employee, EmployeeHierarchyNode, EmployeeInput, FollowUpInput, FollowUpStatus, HouseholdItem, LeadAttachment, LeadFollowUp, LeadStatus, LeadUploadLink, MoveType, MyTask, OpenAiConfiguration, OpenAiConfigurationInput, PackingMaterial, Permission, PresignedUpload, PublicQuotation, PublicSurvey, PublicUploadInfo, Quotation, QuotationDetail, QuotationInput, QuotationItemInput, QuotationLineInput, Role, SalesLead, SalesLeadInput, Survey, SurveyDetail, SurveyDetailsInput, SurveyInput, Tenant, TenantInput, User } from './types'
import { apiUrl } from './apiBase'
import type { Pickup, PickupDetail, PickupStatus, PublicPickup, Vehicle } from './types'

const jsonHeaders = { 'Content-Type': 'application/json' }
let accessToken = localStorage.getItem('movers_token') ?? ''

export function setAccessToken(token: string | null) {
  accessToken = token ?? ''
  if (token) localStorage.setItem('movers_token', token)
  else localStorage.removeItem('movers_token')
}

export async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body) headers.set('Content-Type', 'application/json')
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  const response = await fetch(apiUrl(url), { ...options, headers })
  if (!response.ok) {
    const problem = await response.json().catch(() => null)
    const message = problem?.errors
      ? Object.values(problem.errors).flat().join(' ')
      : problem?.message ?? `Request failed (${response.status})`
    const error = new Error(message) as Error & { status?: number }
    error.status = response.status
    throw error
  }
  if ((options.method ?? 'GET') === 'GET' && url.startsWith('/api/billing/reports/') && !url.includes('/mappings')) lastBillingReport = url
  return response.status === 204 ? undefined as T : response.json() as Promise<T>
}

let lastBillingReport = ''
/** URL of the last accounting report that loaded successfully, so Print re-fetches exactly the filters shown on screen. */
export const lastBillingReportUrl = () => lastBillingReport

export const authApi = {
  login: (email: string, password: string) =>
    request<AuthSession>('/api/auth/login', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ email, password }) }),
  selectTenant: (tenantId: string) =>
    request<AuthSession>('/api/auth/select-tenant', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ tenantId }) }),
}

/** First-time setup: creates the first system administrator while none exists, and signs them in. */
export const setupApi = {
  status: () => request<{ needsSetup: boolean; enabled: boolean; requiresKey: boolean }>('/api/setup/status'),
  createSystemAdmin: (input: { fullName: string; email: string; password: string; setupKey?: string }) =>
    request<AuthSession & { passwordReset?: boolean }>('/api/setup/system-admin', { method: 'POST', body: JSON.stringify(input) }),
}

export const tenantsApi = {
  list: () => request<Tenant[]>('/api/platform/tenants'),
  /** Users of a tenant, managed from the platform without entering the tenant. */
  users: (tenantId: string) => request<User[]>(`/api/platform/tenants/${tenantId}/users`),
  roles: (tenantId: string) => request<Role[]>(`/api/platform/tenants/${tenantId}/roles`),
  createUser: (tenantId: string, input: { fullName: string; email: string; password: string; roleId: string }) => request<User>(`/api/platform/tenants/${tenantId}/users`, { method: 'POST', body: JSON.stringify(input) }),
  setUserStatus: (tenantId: string, userId: string, isActive: boolean) => request<User>(`/api/platform/tenants/${tenantId}/users/${userId}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),
  create: (input: TenantInput) => request<Tenant>('/api/platform/tenants', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, input: TenantInput) => request<Tenant>(`/api/platform/tenants/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  setStatus: (id: string, isActive: boolean) => request<Tenant>(`/api/platform/tenants/${id}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),
}

export const securityApi = {
  users: () => request<User[]>('/api/security/users'),
  createUser: (input: { fullName: string; email: string; password: string; roleId: string; employeeId: string }) =>
    request<User>('/api/security/users', { method: 'POST', body: JSON.stringify(input) }),
  setUserStatus: (id: string, isActive: boolean) =>
    request<User>(`/api/security/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),
  setUserEmployee: (id: string, employeeId: string) =>
    request<User>(`/api/security/users/${id}/employee`, { method: 'PATCH', body: JSON.stringify({ employeeId }) }),
  roles: () => request<Role[]>('/api/security/roles'),
  permissions: () => request<Permission[]>('/api/security/permissions'),
  createRole: (name: string, permissionIds: string[]) =>
    request<Role>('/api/security/roles', { method: 'POST', body: JSON.stringify({ name, permissionIds }) }),
  audit: () => request<AuditLog[]>('/api/security/audit?take=200'),
}

export const employeesApi = {
  designations: () => request<Designation[]>('/api/designations'),
  createDesignation: (input: DesignationInput) =>
    request<Designation>('/api/designations', { method: 'POST', body: JSON.stringify(input) }),
  updateDesignation: (id: string, input: DesignationInput) =>
    request<Designation>(`/api/designations/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  setDesignationStatus: (id: string, isActive: boolean) =>
    request<Designation>(`/api/designations/${id}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),
  employees: () => request<Employee[]>('/api/employees'),
  hierarchy: () => request<EmployeeHierarchyNode[]>('/api/employees/hierarchy'),
  createEmployee: (input: EmployeeInput) =>
    request<Employee>('/api/employees', { method: 'POST', body: JSON.stringify(input) }),
  updateEmployee: (id: string, input: EmployeeInput) =>
    request<Employee>(`/api/employees/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  setEmployeeStatus: (id: string, isActive: boolean) =>
    request<Employee>(`/api/employees/${id}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),
}

export const salesApi = {
  leadStatuses: () => request<LeadStatus[]>('/api/sales/statuses/leads'),
  createLeadStatus: (input: Omit<LeadStatus, 'id' | 'serialNo' | 'isActive'>) => request<LeadStatus>('/api/sales/statuses/leads', { method: 'POST', body: JSON.stringify(input) }),
  updateLeadStatus: (id: string, input: Omit<LeadStatus, 'id' | 'serialNo' | 'isActive'>) => request<LeadStatus>(`/api/sales/statuses/leads/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  setLeadStatusActive: (id: string, isActive: boolean) => request<LeadStatus>(`/api/sales/statuses/leads/${id}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),
  followUpStatuses: () => request<FollowUpStatus[]>('/api/sales/statuses/follow-ups'),
  createFollowUpStatus: (input: Omit<FollowUpStatus, 'id' | 'serialNo' | 'isActive'>) => request<FollowUpStatus>('/api/sales/statuses/follow-ups', { method: 'POST', body: JSON.stringify(input) }),
  updateFollowUpStatus: (id: string, input: Omit<FollowUpStatus, 'id' | 'serialNo' | 'isActive'>) => request<FollowUpStatus>(`/api/sales/statuses/follow-ups/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  setFollowUpStatusActive: (id: string, isActive: boolean) => request<FollowUpStatus>(`/api/sales/statuses/follow-ups/${id}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),
  moveTypes: () => request<MoveType[]>('/api/sales/statuses/move-types'),
  createMoveType: (input: Omit<MoveType, 'id' | 'serialNo' | 'isActive'>) => request<MoveType>('/api/sales/statuses/move-types', { method: 'POST', body: JSON.stringify(input) }),
  updateMoveType: (id: string, input: Omit<MoveType, 'id' | 'serialNo' | 'isActive'>) => request<MoveType>(`/api/sales/statuses/move-types/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  setMoveTypeActive: (id: string, isActive: boolean) => request<MoveType>(`/api/sales/statuses/move-types/${id}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),
  leads: () => request<SalesLead[]>('/api/sales/leads'),
  createLead: (input: SalesLeadInput) => request<SalesLead>('/api/sales/leads', { method: 'POST', body: JSON.stringify(input) }),
  updateLead: (id: string, input: SalesLeadInput) => request<SalesLead>(`/api/sales/leads/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  setLeadActive: (id: string, isActive: boolean) => request<SalesLead>(`/api/sales/leads/${id}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),
  followUps: (leadId: string) => request<LeadFollowUp[]>(`/api/sales/leads/${leadId}/follow-ups`),
  createFollowUp: (leadId: string, input: FollowUpInput) => request<LeadFollowUp>(`/api/sales/leads/${leadId}/follow-ups`, { method: 'POST', body: JSON.stringify(input) }),
  updateFollowUp: (id: string, input: FollowUpInput) => request<LeadFollowUp>(`/api/sales/leads/follow-ups/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  uploadLinks: (leadId: string) => request<LeadUploadLink[]>(`/api/sales/leads/${leadId}/upload-links`),
  generateUploadLink: (leadId: string, validDays: number, requestedItems?: string, description?: string) => request<{ link: LeadUploadLink; url: string }>(`/api/sales/leads/${leadId}/upload-links`, { method: 'POST', body: JSON.stringify({ validDays, requestedItems, description }) }),
  revokeUploadLink: (leadId: string, id: string) => request<LeadUploadLink>(`/api/sales/leads/${leadId}/upload-links/${id}/revoke`, { method: 'PATCH' }),
  attachments: (leadId: string) => request<LeadAttachment[]>(`/api/sales/leads/${leadId}/attachments`),
  attachmentDownload: (leadId: string, id: string) => request<{ url: string }>(`/api/sales/leads/${leadId}/attachments/${id}/download`),
  /** Staff capture on the lead: video, photo or file recorded by the sales team (no customer link). */
  staffUpload: (leadId: string, file: File) => uploadFile<LeadAttachment>(file,
    () => request<PresignedUpload>(`/api/sales/leads/${leadId}/attachments/upload-requests`, { method: 'POST', body: uploadBody(file) }),
    id => request<LeadAttachment>(`/api/sales/leads/${leadId}/attachments/${id}/complete`, { method: 'POST' })),
}

export const publicUploadApi = {
  saveDetails: (token: string, items: string, description: string) => request<void>(`/api/public/lead-uploads/${encodeURIComponent(token)}/details`, { method: 'PUT', body: JSON.stringify({ items, description }) }),
  info: (token: string) => request<PublicUploadInfo>(`/api/public/lead-uploads/${encodeURIComponent(token)}`),
  create: (token: string, file: File) => request<PresignedUpload>(`/api/public/lead-uploads/${encodeURIComponent(token)}/upload-requests`, { method: 'POST', body: JSON.stringify({ fileName: file.name, contentType: file.type || 'application/octet-stream', sizeBytes: file.size }) }),
  complete: (token: string, attachmentId: string) => request<LeadAttachment>(`/api/public/lead-uploads/${encodeURIComponent(token)}/attachments/${attachmentId}/complete`, { method: 'POST' }),
  upload: (token: string, file: File) => uploadFile(file, () => publicUploadApi.create(token, file), attachmentId => publicUploadApi.complete(token, attachmentId)),
}

export const tasksApi = {
  mine: () => request<MyTask[]>(`/api/tasks/mine?timezoneOffsetMinutes=${new Date().getTimezoneOffset()}`),
}

export const surveysApi = {
  items: () => request<HouseholdItem[]>('/api/surveys/masters/items'),
  createItem: (input: Omit<HouseholdItem, 'id' | 'serialNo' | 'isActive'>) => request<HouseholdItem>('/api/surveys/masters/items', { method: 'POST', body: JSON.stringify(input) }),
  updateItem: (id: string, input: Omit<HouseholdItem, 'id' | 'serialNo' | 'isActive'>) => request<HouseholdItem>(`/api/surveys/masters/items/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  materials: () => request<PackingMaterial[]>('/api/surveys/masters/materials'),
  createMaterial: (input: Omit<PackingMaterial, 'id' | 'serialNo' | 'isActive'>) => request<PackingMaterial>('/api/surveys/masters/materials', { method: 'POST', body: JSON.stringify(input) }),
  updateMaterial: (id: string, input: Omit<PackingMaterial, 'id' | 'serialNo' | 'isActive'>) => request<PackingMaterial>(`/api/surveys/masters/materials/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  boxTypes: () => request<BoxType[]>('/api/surveys/masters/box-types'),
  createBoxType: (input: { code: string; name: string; capacityCbm: number; description: string; materials: { materialId: string; quantity: number }[] }) => request<BoxType>('/api/surveys/masters/box-types', { method: 'POST', body: JSON.stringify(input) }),
  updateBoxType: (id: string, input: { code: string; name: string; capacityCbm: number; description: string; materials: { materialId: string; quantity: number }[] }) => request<BoxType>(`/api/surveys/masters/box-types/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  setMasterStatus: (kind: 'items' | 'materials' | 'box-types', id: string, isActive: boolean) => request(`${'/api/surveys/masters'}/${kind}/${id}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),
  surveys: () => request<Survey[]>('/api/surveys'),
  get: (id: string) => request<SurveyDetail>(`/api/surveys/${id}`),
  create: (input: SurveyInput) => request<Survey>('/api/surveys', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, input: SurveyInput) => request<Survey>(`/api/surveys/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  saveDetails: (id: string, input: SurveyDetailsInput) => request<SurveyDetail>(`/api/surveys/${id}/details`, { method: 'PUT', body: JSON.stringify(input) }),
  start: (id: string, at?: string) => request<SurveyDetail>(`/api/surveys/${id}/start`, { method: 'POST', body: JSON.stringify({ at }) }),
  pause: (id: string, reason: string, at?: string) => request<SurveyDetail>(`/api/surveys/${id}/pause`, { method: 'POST', body: JSON.stringify({ reason, at }) }),
  resume: (id: string, at?: string) => request<SurveyDetail>(`/api/surveys/${id}/resume`, { method: 'POST', body: JSON.stringify({ at }) }),
  complete: (id: string, input: { at?: string; distanceKm: number; conductedByEmployeeId: string }) => request<SurveyDetail>(`/api/surveys/${id}/complete`, { method: 'POST', body: JSON.stringify(input) }),
  updateTrip: (id: string, input: { distanceKm: number | null; conductedByEmployeeId: string | null }) => request<SurveyDetail>(`/api/surveys/${id}/trip`, { method: 'PUT', body: JSON.stringify(input) }),
  addExpense: (id: string, input: SurveyExpenseInput) => request<SurveyDetail>(`/api/surveys/${id}/expenses`, { method: 'POST', body: JSON.stringify(input) }),
  updateExpense: (id: string, expenseId: string, input: SurveyExpenseInput) => request<SurveyDetail>(`/api/surveys/${id}/expenses/${expenseId}`, { method: 'PUT', body: JSON.stringify(input) }),
  deleteExpense: (id: string, expenseId: string) => request<SurveyDetail>(`/api/surveys/${id}/expenses/${expenseId}`, { method: 'DELETE' }),
  link: (id: string, validDays = 7) => request<{ url: string; expiresAtUtc: string }>(`/api/surveys/${id}/confirmation-link`, { method: 'POST', body: JSON.stringify({ validDays }) }),
  applyCustomerChanges: (id: string) => request<SurveyDetail>(`/api/surveys/${id}/customer-changes/apply`, { method: 'POST' }),
  dismissCustomerChanges: (id: string) => request<SurveyDetail>(`/api/surveys/${id}/customer-changes/dismiss`, { method: 'POST' }),
  attachments: (id: string) => request<SurveyAttachment[]>(`/api/surveys/${id}/attachments`),
  upload: (id: string, file: File) => uploadFile(file, () => request<PresignedUpload>(`/api/surveys/${id}/attachments/upload-requests`, { method: 'POST', body: uploadBody(file) }), attachmentId => request<SurveyAttachment>(`/api/surveys/${id}/attachments/${attachmentId}/complete`, { method: 'POST' })),
  attachmentDownload: (id: string, attachmentId: string) => request<{ url: string }>(`/api/surveys/${id}/attachments/${attachmentId}/download`),
  deleteAttachment: (id: string, attachmentId: string) => request<void>(`/api/surveys/${id}/attachments/${attachmentId}`, { method: 'DELETE' }),
}

export const publicSurveyApi = {
  get: (token: string) => request<PublicSurvey>(`/api/public/surveys/${encodeURIComponent(token)}`),
  confirmSchedule: (token: string, input: { scheduledAtUtc: string; address: string; latitude: number | null; longitude: number | null; notes: string }) => request<PublicSurvey>(`/api/public/surveys/${encodeURIComponent(token)}/confirm-schedule`, { method: 'POST', body: JSON.stringify(input) }),
  confirmItems: (token: string, notes: string) => request<PublicSurvey>(`/api/public/surveys/${encodeURIComponent(token)}/confirm-items`, { method: 'POST', body: JSON.stringify({ notes }) }),
  catalog: (token: string) => request<CatalogItem[]>(`/api/public/surveys/${encodeURIComponent(token)}/catalog`),
  submitChanges: (token: string, input: CustomerChangesInput) => request<PublicSurvey>(`/api/public/surveys/${encodeURIComponent(token)}/changes`, { method: 'POST', body: JSON.stringify(input) }),
  attachments: (token: string) => request<SurveyAttachment[]>(`/api/public/surveys/${encodeURIComponent(token)}/attachments`),
  upload: (token: string, file: File) => uploadFile(file, () => request<PresignedUpload>(`/api/public/surveys/${encodeURIComponent(token)}/upload-requests`, { method: 'POST', body: uploadBody(file) }), attachmentId => request<SurveyAttachment>(`/api/public/surveys/${encodeURIComponent(token)}/attachments/${attachmentId}/complete`, { method: 'POST' })),
}

export const quotationsApi = {
  revise: (id: string) => request<Quotation>(`/api/quotations/${id}/revisions`, { method: 'POST' }),
  charges: () => request<ChargeMaster[]>('/api/quotations/charges'),
  createCharge: (input: Omit<ChargeMaster, 'id' | 'serialNo' | 'isActive' | 'createdAtUtc' | 'updatedAtUtc'>) => request<ChargeMaster>('/api/quotations/charges', { method: 'POST', body: JSON.stringify(input) }),
  updateCharge: (id: string, input: Omit<ChargeMaster, 'id' | 'serialNo' | 'isActive' | 'createdAtUtc' | 'updatedAtUtc'>) => request<ChargeMaster>(`/api/quotations/charges/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  setChargeStatus: (id: string, isActive: boolean) => request<ChargeMaster>(`/api/quotations/charges/${id}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),
  taxes: () => request<TaxMaster[]>('/api/quotations/taxes'),
  createTax: (input: Omit<TaxMaster, 'id' | 'serialNo' | 'isActive' | 'createdAtUtc' | 'updatedAtUtc'>) => request<TaxMaster>('/api/quotations/taxes', { method: 'POST', body: JSON.stringify(input) }),
  updateTax: (id: string, input: Omit<TaxMaster, 'id' | 'serialNo' | 'isActive' | 'createdAtUtc' | 'updatedAtUtc'>) => request<TaxMaster>(`/api/quotations/taxes/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  setTaxStatus: (id: string, isActive: boolean) => request<TaxMaster>(`/api/quotations/taxes/${id}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),
  list: () => request<Quotation[]>('/api/quotations'),
  get: (id: string) => request<QuotationDetail>(`/api/quotations/${id}`),
  create: (input: QuotationInput) => request<Quotation>('/api/quotations', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, input: QuotationInput) => request<Quotation>(`/api/quotations/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  saveLines: (id: string, lines: QuotationLineInput[]) => request<QuotationDetail>(`/api/quotations/${id}/lines`, { method: 'PUT', body: JSON.stringify({ lines }) }),
  saveItems: (id: string, items: QuotationItemInput[]) => request<QuotationDetail>(`/api/quotations/${id}/items`, { method: 'PUT', body: JSON.stringify({ items }) }),
  applyRequote: (id: string, requestId: string) => request<QuotationDetail>(`/api/quotations/${id}/requote-requests/${requestId}/apply`, { method: 'POST' }),
  share: (id: string, validDays = 7) => request<{ url: string; expiresAtUtc: string }>(`/api/quotations/${id}/share-link`, { method: 'POST', body: JSON.stringify({ validDays }) }),
}

export const publicQuotationApi = {
  get: (token: string) => request<PublicQuotation>(`/api/public/quotations/${encodeURIComponent(token)}`),
  accept: (token: string) => request<PublicQuotation>(`/api/public/quotations/${encodeURIComponent(token)}/accept`, { method: 'POST' }),
  reject: (token: string, reason: string) => request<PublicQuotation>(`/api/public/quotations/${encodeURIComponent(token)}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
  requestRequote: (token: string, input: { customerNotes: string; items: { surveyItemId: string; requestedQuantity: number; notes: string }[] }) => request<PublicQuotation>(`/api/public/quotations/${encodeURIComponent(token)}/request-requote`, { method: 'POST', body: JSON.stringify(input) }),
}

export const pickupsApi = {
  statuses: () => request<PickupStatus[]>('/api/pickups/statuses'),
  createStatus: (input: object) => request<PickupStatus>('/api/pickups/statuses', { method: 'POST', body: JSON.stringify(input) }),
  updateStatus: (id:string,input:object) => request<PickupStatus>(`/api/pickups/statuses/${id}`, { method:'PUT', body:JSON.stringify(input) }),
  setStatusActive: (id:string,isActive:boolean) => request<PickupStatus>(`/api/pickups/statuses/${id}/status`, { method:'PATCH', body:JSON.stringify({isActive}) }),
  vehicles: () => request<Vehicle[]>('/api/pickups/vehicles'),
  createVehicle: (input: object) => request<Vehicle>('/api/pickups/vehicles', { method: 'POST', body: JSON.stringify(input) }),
  updateVehicle: (id:string,input:object) => request<Vehicle>(`/api/pickups/vehicles/${id}`, { method:'PUT', body:JSON.stringify(input) }),
  setVehicleActive: (id:string,isActive:boolean) => request<Vehicle>(`/api/pickups/vehicles/${id}/status`, { method:'PATCH', body:JSON.stringify({isActive}) }),
  list: () => request<Pickup[]>('/api/pickups'),
  create: (input: object) => request<Pickup>('/api/pickups', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, input: object) => request<Pickup>(`/api/pickups/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  get: (id: string) => request<PickupDetail>(`/api/pickups/${id}`),
  saveDetails: (id: string, input: object) => request<PickupDetail>(`/api/pickups/${id}/details`, { method: 'PUT', body: JSON.stringify(input) }),
  addTransaction: (id: string, input: object) => request<PickupDetail>(`/api/pickups/${id}/transactions`, { method: 'POST', body: JSON.stringify(input) }),
  link: (id: string) => request<{url:string;expiresAtUtc:string}>(`/api/pickups/${id}/confirmation-link`, { method: 'POST', body: JSON.stringify({ validDays: 7 }) }),
  work: (id: string) => request<PickupWork>(`/api/pickups/${id}/work`),
  startTrip: (id: string, at?: string) => request<PickupWork>(`/api/pickups/${id}/trip/start`, { method: 'POST', body: JSON.stringify({ at }) }),
  pauseTrip: (id: string, reason: string, at?: string) => request<PickupWork>(`/api/pickups/${id}/trip/pause`, { method: 'POST', body: JSON.stringify({ reason, at }) }),
  resumeTrip: (id: string, at?: string) => request<PickupWork>(`/api/pickups/${id}/trip/resume`, { method: 'POST', body: JSON.stringify({ at }) }),
  completeTrip: (id: string, input: { at?: string; distanceKm: number }) => request<PickupWork>(`/api/pickups/${id}/trip/complete`, { method: 'POST', body: JSON.stringify(input) }),
  updateDistance: (id: string, distanceKm: number | null) => request<PickupWork>(`/api/pickups/${id}/trip/distance`, { method: 'PUT', body: JSON.stringify({ distanceKm }) }),
  addExpense: (id: string, input: SurveyExpenseInput) => request<PickupWork>(`/api/pickups/${id}/expenses`, { method: 'POST', body: JSON.stringify(input) }),
  updateExpense: (id: string, expenseId: string, input: SurveyExpenseInput) => request<PickupWork>(`/api/pickups/${id}/expenses/${expenseId}`, { method: 'PUT', body: JSON.stringify(input) }),
  deleteExpense: (id: string, expenseId: string) => request<PickupWork>(`/api/pickups/${id}/expenses/${expenseId}`, { method: 'DELETE' }),
  upload: (id: string, file: File, stage: string, roomName: string) => uploadFile(file, () => request<PresignedUpload>(`/api/pickups/${id}/attachments/upload-requests`, { method: 'POST', body: JSON.stringify({ stage, roomName, fileName: file.name, contentType: file.type || 'application/octet-stream', sizeBytes: file.size }) }), attachmentId => request<PickupAttachment>(`/api/pickups/${id}/attachments/${attachmentId}/complete`, { method: 'POST' })),
  attachmentDownload: (id: string, attachmentId: string) => request<{ url: string }>(`/api/pickups/${id}/attachments/${attachmentId}/download`),
  deleteAttachment: (id: string, attachmentId: string) => request<void>(`/api/pickups/${id}/attachments/${attachmentId}`, { method: 'DELETE' }),
  sign: (id: string, input: { party: 'EMPLOYEE' | 'CUSTOMER'; signerName: string; employeeId?: string | null; statement: string; remarks?: string; signaturePng: string }) => request<PickupWork>(`/api/pickups/${id}/signoffs`, { method: 'POST', body: JSON.stringify(input) }),
  store: (id: string, input: { warehouseId: string; bay?: string; packageIds: string[]; receivedBy: string; notes?: string }) => request<PickupWork>(`/api/pickups/${id}/warehouse`, { method: 'POST', body: JSON.stringify(input) }),
  warehouses: () => request<Warehouse[]>('/api/pickups/warehouses'),
  createWarehouse: (input: { code: string; name: string; address?: string }) => request<Warehouse>('/api/pickups/warehouses', { method: 'POST', body: JSON.stringify(input) }),
  updateWarehouse: (id: string, input: { code: string; name: string; address?: string }) => request<Warehouse>(`/api/pickups/warehouses/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  setWarehouseActive: (id: string, isActive: boolean) => request<Warehouse>(`/api/pickups/warehouses/${id}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),
}
export const publicPickupApi = { get: (token:string) => request<PublicPickup>(`/api/public/pickups/${encodeURIComponent(token)}`), confirm: (token:string,input:object) => request<PublicPickup>(`/api/public/pickups/${encodeURIComponent(token)}/confirm`, { method:'POST', body:JSON.stringify(input) }) }

export const settingsApi = {
  aws: () => request<AwsConfiguration | undefined>('/api/settings/aws'),
  saveAws: (input: AwsConfigurationInput) => request<AwsConfiguration>('/api/settings/aws', { method: 'PUT', body: JSON.stringify(input) }),
  openAi: () => request<OpenAiConfiguration | undefined>('/api/settings/openai'),
  openAiUsage: () => request<import('./types').AiUsageSummary>('/api/settings/openai/usage'),
  saveOpenAi: (input: OpenAiConfigurationInput) => request<OpenAiConfiguration>('/api/settings/openai', { method: 'PUT', body: JSON.stringify(input) }),
}

export async function downloadFile(url: string, name: string): Promise<void> {
  const headers = new Headers()
  if (accessToken) headers.set('Authorization', 'Bearer ' + accessToken)
  const response = await fetch(apiUrl(url), { headers })
  if (!response.ok) throw new Error('Unable to download report (' + response.status + ')')
  const blob = await response.blob()
  const href = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = href; anchor.download = name; anchor.click()
  setTimeout(() => URL.revokeObjectURL(href), 1000)
}

const uploadBody = (file: File) => JSON.stringify({ fileName: file.name, contentType: file.type || 'application/octet-stream', sizeBytes: file.size })
/** Requests a presigned URL, PUTs the file to storage, then asks the API to verify and record it. */
export async function uploadFile<T>(file: File, create: () => Promise<PresignedUpload>, complete: (attachmentId: string) => Promise<T>): Promise<T> {
  const presigned = await create()
  const response = await fetch(apiUrl(presigned.uploadUrl), { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file })
  if (!response.ok) throw new Error(`Unable to upload ${file.name}.`)
  return complete(presigned.attachmentId)
}

