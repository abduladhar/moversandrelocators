import { request } from './api'
export interface PackageLocation { id: string; trackingNumber: string; status: string; location: string; receivedBy: string; updatedAtUtc: string | null }
export interface Handover { id: string; packageId: string; status: string; location: string; receivedBy: string; notes: string; recordedAtUtc: string }
export interface Claim { id: string; category: string; description: string; owner: string; status: string; resolution: string | null; version: string }
export interface Shipment { pickupId: string; pickupNumber: string; customerName: string; packages: PackageLocation[]; history: Handover[]; claims: Claim[]; packingConfirmed: boolean; allPackagesDelivered: boolean }
export interface PublicPacking { snapshot: { pickupNumber: string; customerName: string; address: string; leftBehindNotes: string; packages: { id: string; trackingNumber: string; boxTypeName: string; items: { itemName: string; quantity: number; notes: string | null }[] }[] }; snapshotHash: string; response: string; responderName: string | null; responseNotes: string | null; respondedAtUtc: string | null; expiresAtUtc: string }
const post = <T,>(url: string, value: unknown) => request<T>(url, { method: 'POST', body: JSON.stringify(value) })
export const shipmentApi = {
  get: (id: string) => request<Shipment>('/api/shipments/' + id),
  share: (id: string, value: unknown) => post<{ url: string; expiresAtUtc: string }>('/api/shipments/' + id + '/share', value),
  revoke: (id: string) => post('/api/shipments/' + id + '/revoke', {}),
  handover: (id: string, value: unknown) => post('/api/shipments/' + id + '/handovers', value),
  claim: (value: unknown) => post('/api/shipments/claims', value),
  resolve: (id: string, value: unknown) => post('/api/shipments/claims/' + id + '/resolve', value),
  public: (token: string) => request<PublicPacking>('/api/public/packing/' + encodeURIComponent(token)),
  respond: (token: string, value: unknown) => post<PublicPacking>('/api/public/packing/' + encodeURIComponent(token) + '/respond', value),
}
