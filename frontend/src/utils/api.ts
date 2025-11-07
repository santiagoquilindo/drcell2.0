import type { CategoriaProducto, Producto } from '@modules/catalog'
import type { InventoryAlert, InventoryItem, InventoryProvider } from '@modules/inventory'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api'

let adminToken: string | null = null

export const setAdminToken = (token: string) => {
  adminToken = token
}

export const clearAdminToken = () => {
  adminToken = null
}

export const getAdminToken = () => adminToken

const ensureAdminToken = () => {
  if (!adminToken) {
    throw new Error('Acceso restringido')
  }
  return adminToken
}

const parseErrorResponse = async (res: Response, fallback: string) => {
  const message = await res
    .json()
    .then((data) => (typeof data?.message === 'string' ? data.message : null))
    .catch(() => null)
  return message ?? fallback
}

type ApiProducto = {
  id: number
  nombre: string
  descripcion: string
  categoria: CategoriaProducto
  precio: number
  imagenUrl?: string | null
  createdAt?: string
}

const mapProducto = (data: ApiProducto): Producto => ({
  id: data.id,
  nombre: data.nombre,
  descripcion: data.descripcion ?? '',
  categoria: data.categoria,
  precio: data.precio,
  imagenUrl: data.imagenUrl ?? undefined,
  createdAt: data.createdAt,
  origin: 'remote',
})

export async function fetchProductos(): Promise<Producto[]> {
  const res = await fetch(`${API_BASE_URL}/products`)
  if (!res.ok) {
    throw new Error('No se pudieron obtener los productos')
  }
  const data: ApiProducto[] = await res.json()
  return data.map(mapProducto)
}

type CreateProductoInput = {
  nombre: string
  descripcion: string
  categoria: CategoriaProducto
  precio: number
  imagenUrl?: string
}

export async function crearProducto(input: CreateProductoInput): Promise<Producto> {
  const token = ensureAdminToken()

  const res = await fetch(`${API_BASE_URL}/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': token,
    },
    body: JSON.stringify(input),
  })

  if (!res.ok) {
    const message = await parseErrorResponse(res, 'No se pudo guardar el producto')
    throw new Error(message)
  }

  const data: ApiProducto = await res.json()
  return mapProducto(data)
}

export async function eliminarProducto(id: number): Promise<void> {
  const token = ensureAdminToken()

  const res = await fetch(`${API_BASE_URL}/products/${id}`, {
    method: 'DELETE',
    headers: {
      'x-api-key': token,
    },
  })

  if (!res.ok) {
    const message = await parseErrorResponse(res, 'No se pudo eliminar el producto')
    throw new Error(message)
  }
}

export type CreateProviderInput = {
  nombre: string
  contacto?: string
  telefono?: string
  email?: string
  notas?: string
}

export type InventoryItemInput = {
  nombre: string
  categoria: string
  proveedorId?: number | null
  stockActual: number
  stockMinimo: number
  precioCompra: number
  precioVenta: number
  descripcion?: string | null
}

type InventoryQueryParams = {
  q?: string
  estado?: 'bajo' | 'ok' | 'todos'
}

export async function fetchProviders(): Promise<InventoryProvider[]> {
  const token = ensureAdminToken()
  const res = await fetch(`${API_BASE_URL}/providers`, {
    headers: { 'x-api-key': token },
  })
  if (!res.ok) {
    const message = await parseErrorResponse(res, 'No se pudieron obtener los proveedores')
    throw new Error(message)
  }
  return res.json()
}

export async function createProvider(input: CreateProviderInput): Promise<InventoryProvider> {
  const token = ensureAdminToken()
  const res = await fetch(`${API_BASE_URL}/providers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': token,
    },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const message = await parseErrorResponse(res, 'No se pudo registrar el proveedor')
    throw new Error(message)
  }
  return res.json()
}

export async function fetchInventory(params: InventoryQueryParams = {}): Promise<InventoryItem[]> {
  const token = ensureAdminToken()
  const query = new URLSearchParams()
  if (params.q) {
    query.set('q', params.q)
  }
  if (params.estado && params.estado !== 'todos') {
    query.set('estado', params.estado)
  }
  const qs = query.toString()
  const res = await fetch(`${API_BASE_URL}/inventory${qs ? `?${qs}` : ''}`, {
    headers: { 'x-api-key': token },
  })
  if (!res.ok) {
    const message = await parseErrorResponse(res, 'No se pudo obtener el inventario')
    throw new Error(message)
  }
  return res.json()
}

export async function fetchInventoryAlerts(): Promise<InventoryAlert[]> {
  const token = ensureAdminToken()
  const res = await fetch(`${API_BASE_URL}/inventory/alerts`, {
    headers: { 'x-api-key': token },
  })
  if (!res.ok) {
    const message = await parseErrorResponse(res, 'No se pudieron obtener las alertas')
    throw new Error(message)
  }
  return res.json()
}

export async function createInventoryItem(input: InventoryItemInput): Promise<InventoryItem> {
  const token = ensureAdminToken()
  const res = await fetch(`${API_BASE_URL}/inventory`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': token,
    },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const message = await parseErrorResponse(res, 'No se pudo registrar el inventario')
    throw new Error(message)
  }
  return res.json()
}

export async function updateInventoryItem(
  id: number,
  input: Partial<InventoryItemInput>,
): Promise<InventoryItem> {
  const token = ensureAdminToken()
  const res = await fetch(`${API_BASE_URL}/inventory/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': token,
    },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const message = await parseErrorResponse(res, 'No se pudo actualizar el inventario')
    throw new Error(message)
  }
  return res.json()
}

export async function deleteInventoryItem(id: number): Promise<void> {
  const token = ensureAdminToken()
  const res = await fetch(`${API_BASE_URL}/inventory/${id}`, {
    method: 'DELETE',
    headers: { 'x-api-key': token },
  })
  if (!res.ok) {
    const message = await parseErrorResponse(res, 'No se pudo eliminar el registro')
    throw new Error(message)
  }
}
