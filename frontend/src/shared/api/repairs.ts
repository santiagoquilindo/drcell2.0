import type { Repair, RepairPayload, RepairSummary, RepairTracking, RepairUpdate, RepairUpdatePayload } from '@shared/types/repair'

import { apiRequest } from './client'

export async function fetchRepairs(query?: { q?: string; estado?: string }) {
  const params = new URLSearchParams()
  if (query?.q) params.set('q', query.q)
  if (query?.estado) params.set('estado', query.estado)

  const suffix = params.toString() ? `?${params.toString()}` : ''
  return apiRequest<RepairSummary[]>(`/repairs${suffix}`, { auth: true })
}

export async function fetchRepair(id: number) {
  return apiRequest<Repair>(`/repairs/${id}`, { auth: true })
}

export async function createRepair(payload: RepairPayload) {
  return apiRequest<Repair>('/repairs', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
  })
}

export async function updateRepair(id: number, payload: Partial<RepairPayload>) {
  return apiRequest<Repair>(`/repairs/${id}`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify(payload),
  })
}

export async function addRepairUpdate(id: number, payload: RepairUpdatePayload) {
  return apiRequest<RepairUpdate>(`/repairs/${id}/updates`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
  })
}

export async function fetchRepairTracking(payload: { code: string; verifier: string }) {
  return apiRequest<RepairTracking>('/repairs/public/lookup', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
