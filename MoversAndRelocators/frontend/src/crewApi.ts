import { request } from './api'

export type TeamKind = 'PACKING' | 'PICKUP' | 'BOTH'

export type TeamMember = {
  membershipId: string; employeeId: string; employeeName: string; employeeNumber: string
  role: string; joinedAtUtc: string; leftAtUtc: string | null; leaveReason: string | null; recordedBy: string
}
export type Team = {
  id: string; code: string; name: string; kind: TeamKind; supervisorEmployeeId: string | null; supervisorName: string | null
  notes: string | null; isActive: boolean; version: string; currentMembers: number; members: TeamMember[]
}
export type EmployeeWork = {
  employeeId: string; employeeName: string; employeeNumber: string
  packingJobs: number; pickups: number; boxesPacked: number; boxesPicked: number
  lastWorkedAtUtc: string | null; teamsWorkedUnder: string[]
}
export type TeamPerformance = {
  teamId: string; teamName: string; kind: TeamKind
  packingJobs: number; pickups: number; boxesPacked: number; boxesPicked: number
  peopleInvolved: number; currentMembers: number; lastWorkedAtUtc: string | null
}
export type CrewOverview = { teams: TeamPerformance[]; employees: EmployeeWork[]; from: string | null; to: string | null }

export type SaveTeam = { code: string; name: string; kind: TeamKind; supervisorEmployeeId?: string | null; notes?: string | null }

const base = '/api/crew'
const send = <T,>(url: string, method: string, body?: unknown) =>
  request<T>(url, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })

export const crewApi = {
  teams: (includeInactive = false) => request<Team[]>(`${base}/teams${includeInactive ? '?includeInactive=true' : ''}`),
  team: (id: string) => request<Team>(`${base}/teams/${id}`),
  create: (v: SaveTeam) => send<Team>(`${base}/teams`, 'POST', v),
  update: (id: string, v: SaveTeam) => send<Team>(`${base}/teams/${id}`, 'PUT', v),
  setActive: (id: string, active: boolean) => send<Team>(`${base}/teams/${id}/active?active=${active}`, 'PUT'),
  addMember: (id: string, v: { employeeId: string; role: string; joinedAt?: string | null }) => send<Team>(`${base}/teams/${id}/members`, 'POST', v),
  removeMember: (id: string, employeeId: string, v: { leftAt?: string | null; reason?: string | null }) =>
    send<Team>(`${base}/teams/${id}/members/${employeeId}`, 'DELETE', v),
  moveMember: (fromTeamId: string, v: { employeeId: string; toTeamId: string; role?: string | null; at?: string | null; reason?: string | null }) =>
    send<Team>(`${base}/teams/${fromTeamId}/members/move`, 'POST', v),
  performance: (from?: string, to?: string) => {
    const q = new URLSearchParams()
    if (from) q.set('from', from)
    if (to) q.set('to', to)
    return request<CrewOverview>(`${base}/performance${q.toString() ? `?${q}` : ''}`)
  },
  seedDemo: () => send<{ created: number }>(`${base}/demo-data`, 'POST'),
}
