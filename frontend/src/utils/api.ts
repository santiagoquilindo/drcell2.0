import type { CategoriaProducto, Producto } from '@modules/catalog'
import type { InventoryAlert, InventoryItem, InventoryProvider } from '@modules/inventory'
import type {
  InvoiceDetail,
  InvoiceItemInput,
  InvoiceStatus,
  InvoiceSummary,
  InvoiceType,
} from '@modules/invoices'
import type { Client, ClientInput } from '@modules/clients'
import type { RepairDetail, RepairInput, RepairStatus, RepairSummary, RepairUpdate } from '@modules/repairs'
import type { DiagnosticRequest, DiagnosticResponse } from '@modules/assistant'
import type {
  CreateReturnInput,
  ReturnAttachment,
  ReturnCloseInput,
  ReturnDetail,
  ReturnMovement,
  ReturnMovementInput,
  ReturnStateInput,
  ReturnStatus,
  ReturnSummary,
} from '@modules/returns'

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

type InvoiceQueryParams = {
  q?: string
  tipo?: InvoiceType
  estado?: InvoiceStatus
}

export type CreateInvoiceInput = {
  tipo: InvoiceType
  clienteNombre: string
  clienteIdentificacion?: string
  clienteTelefono?: string
  clienteEmail?: string
  clienteDireccion?: string
  notas?: string
  anticipo?: number
  items: InvoiceItemInput[]
}

export async function fetchInvoices(params: InvoiceQueryParams = {}): Promise<InvoiceSummary[]> {
  const token = ensureAdminToken()
  const search = new URLSearchParams()
  if (params.q) search.set('q', params.q)
  if (params.tipo) search.set('tipo', params.tipo)
  if (params.estado) search.set('estado', params.estado)

  const qs = search.toString()
  const res = await fetch(`${API_BASE_URL}/invoices${qs ? `?${qs}` : ''}`, {
    headers: { 'x-api-key': token },
  })

  if (!res.ok) {
    const message = await parseErrorResponse(res, 'No se pudieron obtener las facturas')
    throw new Error(message)
  }
  return res.json()
}

export async function fetchInvoiceDetail(id: number): Promise<InvoiceDetail> {
  const token = ensureAdminToken()
  const res = await fetch(`${API_BASE_URL}/invoices/${id}`, {
    headers: { 'x-api-key': token },
  })
  if (!res.ok) {
    const message = await parseErrorResponse(res, 'No se pudo obtener la factura')
    throw new Error(message)
  }
  return res.json()
}

export async function createInvoice(input: CreateInvoiceInput): Promise<InvoiceDetail> {
  const token = ensureAdminToken()
  const res = await fetch(`${API_BASE_URL}/invoices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': token,
    },
    body: JSON.stringify(input),
  })

  if (!res.ok) {
    const message = await parseErrorResponse(res, 'No se pudo crear la factura')
    throw new Error(message)
  }
  return res.json()
}

export async function updateInvoiceStatus(
  id: number,
  data: { estado: InvoiceStatus; notas?: string; anticipo?: number },
): Promise<InvoiceSummary> {
  const token = ensureAdminToken()
  const res = await fetch(`${API_BASE_URL}/invoices/${id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': token,
    },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const message = await parseErrorResponse(res, 'No se pudo actualizar la factura')
    throw new Error(message)
  }
  return res.json()
}

export async function downloadInvoicePdf(id: number): Promise<Blob> {
  const token = ensureAdminToken()
  const res = await fetch(`${API_BASE_URL}/invoices/${id}/pdf`, {
    headers: { 'x-api-key': token },
  })
  if (!res.ok) {
    const message = await parseErrorResponse(res, 'No se pudo generar el PDF')
    throw new Error(message)
  }
  return res.blob()
}

export async function fetchClients(params: { q?: string } = {}): Promise<Client[]> {
  const token = ensureAdminToken()
  const search = params.q ? `?q=${encodeURIComponent(params.q)}` : ''
  const res = await fetch(`${API_BASE_URL}/clients${search}`, {
    headers: { 'x-api-key': token },
  })
  if (!res.ok) {
    const message = await parseErrorResponse(res, 'No se pudieron obtener los clientes')
    throw new Error(message)
  }
  return res.json()
}

export async function createClient(input: ClientInput): Promise<Client> {
  const token = ensureAdminToken()
  const sanitize = (value?: string) => {
    const trimmed = value?.trim()
    return trimmed ? trimmed : undefined
  }
  const payload = {
    nombre: input.nombre.trim(),
    documento: sanitize(input.documento),
    telefono: sanitize(input.telefono),
    email: sanitize(input.email),
    direccion: sanitize(input.direccion),
    notas: sanitize(input.notas),
  }
  const res = await fetch(`${API_BASE_URL}/clients`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': token,
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const message = await parseErrorResponse(res, 'No se pudo registrar el cliente')
    throw new Error(message)
  }
  return res.json()
}

export async function fetchRepairs(params: { q?: string; estado?: RepairStatus } = {}): Promise<RepairSummary[]> {
  const token = ensureAdminToken()
  const search = new URLSearchParams()
  if (params.q) search.set('q', params.q)
  if (params.estado) search.set('estado', params.estado)
  const qs = search.toString()
  const res = await fetch(`${API_BASE_URL}/repairs${qs ? `?${qs}` : ''}`, {
    headers: { 'x-api-key': token },
  })
  if (!res.ok) {
    const message = await parseErrorResponse(res, 'No se pudo obtener el listado de reparaciones')
    throw new Error(message)
  }
  return res.json()
}

export async function fetchRepairDetail(id: number): Promise<RepairDetail> {
  const token = ensureAdminToken()
  const res = await fetch(`${API_BASE_URL}/repairs/${id}`, {
    headers: { 'x-api-key': token },
  })
  if (!res.ok) {
    const message = await parseErrorResponse(res, 'No se encontró la reparación solicitada')
    throw new Error(message)
  }
  return res.json()
}

export async function createRepair(input: RepairInput): Promise<RepairDetail> {
  const token = ensureAdminToken()
  const res = await fetch(`${API_BASE_URL}/repairs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': token,
    },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const message = await parseErrorResponse(res, 'No se pudo registrar la reparación')
    throw new Error(message)
  }
  return res.json()
}

export async function updateRepair(id: number, data: Partial<RepairInput>): Promise<RepairDetail> {
  const token = ensureAdminToken()
  const res = await fetch(`${API_BASE_URL}/repairs/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': token,
    },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const message = await parseErrorResponse(res, 'No se pudo actualizar la reparación')
    throw new Error(message)
  }
  return res.json()
}

export async function addRepairProgress(id: number, data: { estado: RepairStatus; comentario?: string; registradoPor?: string }): Promise<RepairUpdate> {
  const token = ensureAdminToken()
  const res = await fetch(`${API_BASE_URL}/repairs/${id}/updates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': token,
    },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const message = await parseErrorResponse(res, 'No se pudo registrar el progreso')
    throw new Error(message)
  }
  return res.json()
}

export async function downloadRepairSticker(id: number): Promise<Blob> {
  const token = ensureAdminToken()
  const res = await fetch(`${API_BASE_URL}/repairs/${id}/sticker`, {
    headers: { 'x-api-key': token },
  })
  if (!res.ok) {
    const message = await parseErrorResponse(res, 'No se pudo generar el sticker')
    throw new Error(message)
  }
  return res.blob()
}

export async function fetchReturns(params: { estado?: ReturnStatus; alerta?: string; q?: string } = {}): Promise<ReturnSummary[]> {
  const token = ensureAdminToken()
  const search = new URLSearchParams()
  if (params.estado) search.set('estado', params.estado)
  if (params.alerta) search.set('alerta', params.alerta)
  if (params.q) search.set('q', params.q)
  const res = await fetch(`${API_BASE_URL}/returns${search.toString() ? `?${search.toString()}` : ''}`, {
    headers: { 'x-api-key': token },
  })
  if (!res.ok) {
    const message = await parseErrorResponse(res, 'No se pudieron obtener las devoluciones')
    throw new Error(message)
  }
  return res.json()
}

export async function createReturn(input: CreateReturnInput): Promise<ReturnDetail> {
  const token = ensureAdminToken()
  const res = await fetch(`${API_BASE_URL}/returns`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': token,
    },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const message = await parseErrorResponse(res, 'No se pudo registrar la devolución')
    throw new Error(message)
  }
  return res.json()
}

export async function fetchReturnDetail(id: number): Promise<ReturnDetail> {
  const token = ensureAdminToken()
  const res = await fetch(`${API_BASE_URL}/returns/${id}`, {
    headers: { 'x-api-key': token },
  })
  if (!res.ok) {
    const message = await parseErrorResponse(res, 'No se encontró la devolución')
    throw new Error(message)
  }
  return res.json()
}

export async function updateReturn(id: number, data: Partial<CreateReturnInput>): Promise<ReturnDetail> {
  const token = ensureAdminToken()
  const res = await fetch(`${API_BASE_URL}/returns/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': token,
    },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const message = await parseErrorResponse(res, 'No se pudo actualizar la devolución')
    throw new Error(message)
  }
  return res.json()
}

export async function addReturnMovement(id: number, data: ReturnMovementInput): Promise<ReturnMovement[]> {
  const token = ensureAdminToken()
  const res = await fetch(`${API_BASE_URL}/returns/${id}/movimientos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': token,
    },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const message = await parseErrorResponse(res, 'No se pudo registrar el movimiento')
    throw new Error(message)
  }
  return res.json()
}

export async function changeReturnState(id: number, data: ReturnStateInput): Promise<ReturnDetail> {
  const token = ensureAdminToken()
  const res = await fetch(`${API_BASE_URL}/returns/${id}/estado`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': token,
    },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const message = await parseErrorResponse(res, 'No se pudo actualizar el estado')
    throw new Error(message)
  }
  return res.json()
}

export async function addReturnAttachment(
  id: number,
  data: { tipo: string; url: string; nombre?: string; subidoPor: string },
): Promise<ReturnAttachment[]> {
  const token = ensureAdminToken()
  const res = await fetch(`${API_BASE_URL}/returns/${id}/adjuntos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': token,
    },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const message = await parseErrorResponse(res, 'No se pudo adjuntar el archivo')
    throw new Error(message)
  }
  return res.json()
}

export async function closeReturn(id: number, data: ReturnCloseInput): Promise<ReturnDetail> {
  const token = ensureAdminToken()
  const res = await fetch(`${API_BASE_URL}/returns/${id}/cerrar`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': token,
    },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const message = await parseErrorResponse(res, 'No se pudo cerrar la devolución')
    throw new Error(message)
  }
  return res.json()
}

export async function downloadReturnsReport(params: { estado?: ReturnStatus; desde?: string; hasta?: string } = {}) {
  const token = ensureAdminToken()
  const search = new URLSearchParams()
  if (params.estado) search.set('estado', params.estado)
  if (params.desde) search.set('desde', params.desde)
  if (params.hasta) search.set('hasta', params.hasta)
  const res = await fetch(`${API_BASE_URL}/returns/report/export${search.toString() ? `?${search.toString()}` : ''}`, {
    headers: { 'x-api-key': token },
  })
  if (!res.ok) {
    const message = await parseErrorResponse(res, 'No se pudo generar el reporte')
    throw new Error(message)
  }
  return res.blob()
}

export async function requestDiagnosticAssistant(input: DiagnosticRequest): Promise<DiagnosticResponse> {
  const res = await fetch(`${API_BASE_URL}/assistant/diagnostic`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const message = await parseErrorResponse(res, 'No se pudo obtener la sugerencia')
    throw new Error(message)
  }
  return res.json()
}
