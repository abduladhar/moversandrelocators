import { request } from './api'
import type { WarehouseStock, WarehouseShipping } from './warehouseApi'
export type JobDetails = { mode: 'AIR'|'OCEAN'|'ROAD'; originPort: string; destinationPort: string; originAgentCode?: string; destinationAgentCode?: string; originAgentName?: string; destinationAgentName?: string; carrier?: string; flightNumber?: string; airWaybill?: string; vesselName?: string; voyageNumber?: string; billOfLading?: string; containerNumber?: string; sealNumber?: string; truckNumber?: string; trailerNumber?: string; driverName?: string; driverPhone?: string; roadReference?: string; estimatedDeparture?: string; estimatedArrival?: string; notes?: string }
export type JobCargo = { id: string; boxId: string; isActive: boolean; loadedAtUtc: string; loadedBy: string; unloadedAtUtc?: string; unloadedBy?: string; details: { box: WarehouseStock; shipping?: WarehouseShipping } }
export type Job = { id: string; jobNumber: string; status: string; version: string; createdAtUtc: string; departedAtUtc?: string; arrivedAtUtc?: string; details: JobDetails; cargo: JobCargo[] }
export const jobApi = {
 list: () => request<Job[]>('/api/jobs'),
 get: (id: string) => request<Job>('/api/jobs/'+id),
 create: (requestId: string, details: JobDetails) => request<Job>('/api/jobs', { method: 'POST', body: JSON.stringify({ requestId, details }) }),
 edit: (job: Job, details: JobDetails) => request<Job>('/api/jobs/'+job.id, { method: 'PUT', body: JSON.stringify({ expectedVersion: job.version, details }) }),
 load: (job: Job, boxIds: string[], loadedBy: string) => request<Job>('/api/jobs/'+job.id+'/load', { method: 'POST', body: JSON.stringify({ expectedVersion: job.version, boxIds, loadedBy }) }),
 step: (job: Job, action: string) => request<Job>('/api/jobs/'+job.id+'/actions/'+action, { method: 'POST', body: JSON.stringify({ expectedVersion: job.version }) }),
 unload: (job: Job, cargoId: string) => request<Job>('/api/jobs/'+job.id+'/cargo/'+cargoId+'/return', { method: 'POST', body: JSON.stringify({ expectedVersion: job.version }) }),
}
