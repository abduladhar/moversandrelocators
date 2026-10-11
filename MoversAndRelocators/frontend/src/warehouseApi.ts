import { request, uploadFile } from './api'
import type { PresignedUpload } from './types'
export type WarehouseParty = { name?: string; phone?: string; address?: string }
export type WarehouseShipping = { shipper?: WarehouseParty; consignee?: WarehouseParty; toLocation?: string; dropLocation?: string; dropAddress?: string }
export type WarehouseFile = { id: string; originalFileName: string; contentType: string; sizeBytes: number; uploadedBy: string; uploadedAtUtc?: string }
export type ReceiptBox = { id: string; trackingNumber: string; description: string; customerReference?: string; condition: string; sealNumber?: string; contents: string; contentsChecked: boolean }
export type WarehouseReceipt = { version: string; id: string; receiptNumber: string; source: 'OFFICE' | 'PICKUP'; warehouseId: string; pickupId?: string; receivedAtUtc: string; details: { customerName: string; customerCode?: string; phone?: string; address?: string; warehouseName: string; bay?: string; deliveredBy: string; receivedBy: string; notes?: string; pickupNumber?: string; boxes: ReceiptBox[]; shipping?: WarehouseShipping } }
export type WarehouseStock = { id: string; trackingNumber: string; customerName: string; source: string; warehouseId: string; warehouseName: string; location: string; reference: string; receivedAtUtc: string; receivedBy: string; description: string; contents: string }
export const warehouseApi = {
 shipping: (id: string, expectedVersion: string, shipping: WarehouseShipping) => request<WarehouseReceipt>(`/api/warehouse/receipts/${id}/shipping`, { method: 'PUT', body: JSON.stringify({ expectedVersion, shipping }) }),
 files: (id: string) => request<WarehouseFile[]>(`/api/warehouse/receipts/${id}/attachments`),
 upload: (id: string, file: File) => uploadFile(file, () => request<PresignedUpload>(`/api/warehouse/receipts/${id}/attachments/upload-requests`, { method: 'POST', body: JSON.stringify({ fileName: file.name, contentType: file.type || 'application/octet-stream', sizeBytes: file.size }) }), fileId => request<WarehouseFile>(`/api/warehouse/receipts/${id}/attachments/${fileId}/complete`, { method: 'POST' })),
 download: (id: string, fileId: string) => request<{ url: string }>(`/api/warehouse/receipts/${id}/attachments/${fileId}/download`),
 removeFile: (id: string, fileId: string) => request<boolean>(`/api/warehouse/receipts/${id}/attachments/${fileId}`, { method: 'DELETE' }),
 stock: () => request<WarehouseStock[]>('/api/warehouse/stock'),
 receipts: () => request<WarehouseReceipt[]>('/api/warehouse/receipts'),
 receive: (source: 'office' | 'pickup', input: object) => request<WarehouseReceipt>(`/api/warehouse/receive-${source}`, { method: 'POST', body: JSON.stringify(input) }),
}

