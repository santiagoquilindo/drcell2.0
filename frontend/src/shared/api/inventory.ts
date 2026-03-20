import type {
  InventoryCategory,
  InventoryCategoryPayload,
  InventoryItem,
  InventoryItemDetail,
  InventoryItemPayload,
  InventoryMovement,
  InventoryMovementPayload,
  InventoryProvider,
} from '@shared/types/inventory'

import { apiRequest } from './client'

export async function fetchInventoryCategories() {
  return apiRequest<InventoryCategory[]>('/inventory/categories', { auth: true })
}

export async function createInventoryCategory(payload: InventoryCategoryPayload) {
  return apiRequest<InventoryCategory>('/inventory/categories', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
  })
}

export async function updateInventoryCategory(id: number, payload: Partial<InventoryCategoryPayload>) {
  return apiRequest<InventoryCategory>(`/inventory/categories/${id}`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify(payload),
  })
}

export async function fetchInventoryItems(filters?: {
  q?: string
  categoriaId?: number
  tipo?: string
  estado?: string
  lowStock?: boolean
}) {
  const params = new URLSearchParams()
  if (filters?.q) params.set('q', filters.q)
  if (filters?.categoriaId) params.set('categoriaId', String(filters.categoriaId))
  if (filters?.tipo) params.set('tipo', filters.tipo)
  if (filters?.estado) params.set('estado', filters.estado)
  if (filters?.lowStock) params.set('lowStock', 'true')
  const suffix = params.toString() ? `?${params.toString()}` : ''
  return apiRequest<InventoryItem[]>(`/inventory/items${suffix}`, { auth: true })
}

export async function fetchInventoryItem(id: number) {
  return apiRequest<InventoryItemDetail>(`/inventory/items/${id}`, { auth: true })
}

export async function createInventoryItem(payload: InventoryItemPayload) {
  return apiRequest<InventoryItemDetail>('/inventory/items', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
  })
}

export async function updateInventoryItem(id: number, payload: Partial<InventoryItemPayload>) {
  return apiRequest<InventoryItemDetail>(`/inventory/items/${id}`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify(payload),
  })
}

export async function createInventoryMovement(id: number, payload: InventoryMovementPayload) {
  return apiRequest<InventoryItemDetail>(`/inventory/items/${id}/movements`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
  })
}

export async function fetchInventoryMovements(filters?: {
  itemId?: number
  tipo?: string
  from?: string
  to?: string
  q?: string
}) {
  const params = new URLSearchParams()
  if (filters?.itemId) params.set('itemId', String(filters.itemId))
  if (filters?.tipo) params.set('tipo', filters.tipo)
  if (filters?.from) params.set('from', filters.from)
  if (filters?.to) params.set('to', filters.to)
  if (filters?.q) params.set('q', filters.q)
  const suffix = params.toString() ? `?${params.toString()}` : ''
  return apiRequest<InventoryMovement[]>(`/inventory/movements${suffix}`, { auth: true })
}

export async function fetchLowStockItems() {
  return apiRequest<InventoryItem[]>('/inventory/low-stock', { auth: true })
}

export async function fetchProviders() {
  return apiRequest<InventoryProvider[]>('/providers', { auth: true })
}
