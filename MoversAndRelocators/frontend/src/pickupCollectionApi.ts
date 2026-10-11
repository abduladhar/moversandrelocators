import { request, uploadFile } from './api'
import type { PresignedUpload } from './types'

export type BoxSource = 'PACKING' | 'PICKUP'
export type BoxStatus = 'PENDING' | 'PICKED' | 'EXCLUDED' | 'MISSING'
export type BoxCondition = 'NOT_CHECKED' | 'OK' | 'DAMAGED'
export type PickMethod = 'LIST' | 'SCAN' | 'BULK'
export type CollectionMedia = { id: string; fileName: string; contentType: string; sizeBytes: number; isUploaded: boolean; uploadedBy: string; createdAtUtc: string }

export type SelectablePackingJob = { id: string; jobNumber: string; status: string; customerName: string; address: string; scheduledAtUtc: string; boxCount: number; collectedElsewhere: number; remaining: number }
export type LinkedPackingJob = { id: string; jobNumber: string; status: string; customerName: string; address: string; scheduledAtUtc: string; linkedAtUtc: string; linkedBy: string; expected: number; picked: number; missing: number; excluded: number; pending: number }
export type CollectionBox = { boxId: string; source: BoxSource; trackingNumber: string; boxTypeName: string; roomName: string | null; isFragile: boolean; notes: string | null; itemCount: number; packingJobId: string | null; packingJobNumber: string | null; addedBy: string; addedAtUtc: string; status: BoxStatus; statusAtUtc: string | null; statusBy: string | null; method: PickMethod | null; statusReason: string | null; condition: BoxCondition; conditionNotes: string | null; conditionAtUtc: string | null; conditionBy: string | null; media: CollectionMedia[]; version: string }
export type CollectionEvent = { id: string; source: BoxSource; boxId: string; trackingNumber: string; fromStatus: BoxStatus; toStatus: BoxStatus; method: PickMethod; occurredAtUtc: string; actor: string; notes: string | null }
export type CollectionApproval = { id: string; warehouseId: string | null; warehouseName: string | null; pickedCount: number; missingCount: number; excludedCount: number; approvedAtUtc: string; approvedBy: string; notes: string | null; reopenedAtUtc: string | null; reopenedBy: string | null; reopenReason: string | null }
export type PickupCollection = { pickupId: string; pickupNumber: string; jobs: LinkedPackingJob[]; boxes: CollectionBox[]; expected: number; picked: number; missing: number; excluded: number; pending: number; damaged: number; hasUnresolved: boolean; isApproved: boolean; canReopen: boolean; approval: CollectionApproval | null }

const base = (pickupId: string) => `/api/pickups/${pickupId}/collection`
const send = <T,>(url: string, method: string, body?: unknown) => request<T>(url, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })

export const pickupCollectionApi = {
  get: (pickupId: string) => request<PickupCollection>(base(pickupId)),
  selectableJobs: (pickupId: string, search?: string) =>
    request<SelectablePackingJob[]>(`${base(pickupId)}/packing-jobs/selectable${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  addJobs: (pickupId: string, packingJobIds: string[]) => send<PickupCollection>(`${base(pickupId)}/packing-jobs`, 'POST', { packingJobIds }),
  removeJob: (pickupId: string, packingJobId: string) => send<PickupCollection>(`${base(pickupId)}/packing-jobs/${packingJobId}`, 'DELETE'),
  setStatus: (pickupId: string, v: { source: BoxSource; boxId: string; status: BoxStatus; method?: PickMethod; reason?: string | null }) =>
    send<PickupCollection>(`${base(pickupId)}/boxes`, 'PUT', v),
  addBox: (pickupId: string, v: { boxTypeId: string; roomName?: string | null; isFragile: boolean; notes?: string | null; copies?: number }) =>
    send<PickupCollection>(`${base(pickupId)}/boxes`, 'POST', v),
  setCondition: (pickupId: string, v: { source: BoxSource; boxId: string; condition: BoxCondition; notes?: string | null }) =>
    send<PickupCollection>(`${base(pickupId)}/boxes/condition`, 'PUT', v),

  /** Box evidence rides the pickup's existing attachment pipeline, tagged with the box it belongs to. */
  uploadMedia: (pickupId: string, file: File, source: BoxSource, boxId: string) => uploadFile(file,
    () => request<PresignedUpload>(`/api/pickups/${pickupId}/attachments/upload-requests`, {
      method: 'POST',
      body: JSON.stringify({ stage: 'BEFORE_PICKUP', fileName: file.name, contentType: file.type || 'application/octet-stream', sizeBytes: file.size, boxSource: source, boxId }),
    }),
    attachmentId => request<unknown>(`/api/pickups/${pickupId}/attachments/${attachmentId}/complete`, { method: 'POST' })),
  mediaDownload: (pickupId: string, attachmentId: string) => request<{ url: string }>(`/api/pickups/${pickupId}/attachments/${attachmentId}/download`),
  deleteMedia: (pickupId: string, attachmentId: string) => request<void>(`/api/pickups/${pickupId}/attachments/${attachmentId}`, { method: 'DELETE' }),
  scan: (pickupId: string, trackingNumber: string, status: BoxStatus = 'PICKED', reason?: string | null) =>
    send<PickupCollection>(`${base(pickupId)}/scan`, 'POST', { trackingNumber, status, reason }),
  bulk: (pickupId: string, status: BoxStatus, packingJobId?: string | null, reason?: string | null) =>
    send<PickupCollection>(`${base(pickupId)}/boxes/bulk`, 'POST', { status, packingJobId, reason }),
  history: (pickupId: string, source?: BoxSource, boxId?: string) =>
    request<CollectionEvent[]>(`${base(pickupId)}/history${source && boxId ? `?source=${source}&boxId=${boxId}` : ''}`),
  approve: (pickupId: string, v: { warehouseId?: string | null; notes?: string | null; acceptMissing?: boolean }) =>
    send<PickupCollection>(`${base(pickupId)}/approve`, 'POST', v),
  reopen: (pickupId: string, reason: string) => send<PickupCollection>(`${base(pickupId)}/reopen`, 'POST', { reason }),
}
