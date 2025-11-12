export const RETURN_STATUSES = [
  'reportada',
  'revision_tecnica',
  'entregada_proveedor',
  'espera_regreso',
  'devuelta_reemplazo',
  'devuelta_reembolso',
  'reparada_entregada',
  'rechazada',
  'cerrada',
] as const

export type ReturnStatus = (typeof RETURN_STATUSES)[number]

export type ReturnSummary = {
  id: number
  codigo: string
  estado: ReturnStatus
  motivo: string
  diagnostico?: string | null
  slaProveedor?: string | null
  slaAlerta?: '72h' | '24h' | 'overdue' | null
  createdAt: string
  updatedAt: string
  resultadoFinal?: string | null
  proveedorNombre?: string | null
  clienteNombre?: string | null
}

export type ReturnMovement = {
  id: number
  tipo: string
  entregadoPor: string
  recibidoPor: string
  fecha: string
  notas?: string | null
}

export type ReturnHistory = {
  id: number
  estado: ReturnStatus
  comentario?: string | null
  actor: string
  metadata?: Record<string, unknown> | null
  createdAt: string
}

export type ReturnAttachment = {
  id: number
  tipo: string
  url: string
  nombre?: string | null
  subidoPor: string
  createdAt: string
}

export type ReturnDetail = ReturnSummary & {
  productoNombre?: string | null
  proveedorId?: number | null
  clienteId?: number | null
  movements: ReturnMovement[]
  history: ReturnHistory[]
  attachments: ReturnAttachment[]
}

export type CreateReturnInput = {
  inventarioItemId?: number
  productoNombre?: string
  proveedorId?: number
  clienteId?: number
  motivo: string
  diagnostico?: string
  slaProveedor?: string
  primerMovimiento: {
    tipo: string
    entregadoPor: string
    recibidoPor: string
    fecha?: string
    notas?: string
  }
}

export type ReturnMovementInput = {
  tipo: string
  entregadoPor: string
  recibidoPor: string
  fecha?: string
  notas?: string
}

export type ReturnStateInput = {
  estado: ReturnStatus
  comentario?: string
  slaProveedor?: string
}

export type ReturnCloseInput = {
  resultadoFinal: string
  ajusteStock: boolean
  ajusteNotas?: string
  cerradaPor: string
}
