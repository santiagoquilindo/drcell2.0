import type { Client } from './clients'

export const REPAIR_STATUSES = ['ingresado', 'diagnostico', 'en_proceso', 'listo', 'entregado'] as const
export type RepairStatus = (typeof REPAIR_STATUSES)[number]

export type RepairMediaItem = {
  id: string
  tipo: string
  src: string
  origin: 'base' | 'local'
  mime?: string
  name?: string
  uploadedAt?: number
}

export const REPARACIONES_BASE: RepairMediaItem[] = [
  {
    id: 'base-cambio-pantalla',
    tipo: 'Cambio de pantalla',
    src: 'https://images.unsplash.com/photo-1583225272832-1d0956ac9b62?q=80&w=1200&auto=format&fit=crop',
    origin: 'base',
  },
  {
    id: 'base-reparacion-placa',
    tipo: 'Reparación placa',
    src: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?q=80&w=1200&auto=format&fit=crop',
    origin: 'base',
  },
  {
    id: 'base-cambio-bateria',
    tipo: 'Cambio batería',
    src: 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?q=80&w=1200&auto=format&fit=crop',
    origin: 'base',
  },
]

export type RepairSummary = {
  id: number
  codigo: string
  estado: RepairStatus
  dispositivoTipo?: string | null
  marca?: string | null
  modelo?: string | null
  motivoIngreso?: string | null
  responsable?: string | null
  createdAt: string
  clienteId: number
  clienteNombre: string
  costoEstimado?: number
  costoFinal?: number
}

export type RepairDetail = {
  id: number
  codigo: string
  estado: RepairStatus
  dispositivoTipo?: string | null
  marca?: string | null
  modelo?: string | null
  referencia?: string | null
  color?: string | null
  serie?: string | null
  motivoIngreso?: string | null
  diagnostico?: string | null
  accesorios?: string | null
  costoEstimado?: number
  costoFinal?: number
  responsable?: string | null
  notas?: string | null
  createdAt: string
  updatedAt: string
  cliente: Pick<Client, 'id' | 'nombre' | 'documento' | 'telefono' | 'email'>
  updates: RepairUpdate[]
}

export type RepairUpdate = {
  id: number
  estado: RepairStatus
  comentario?: string | null
  registradoPor?: string | null
  createdAt: string
}

export type RepairInput = {
  clientId?: number
  client?: {
    nombre: string
    documento?: string
    telefono?: string
    email?: string
    direccion?: string
    notas?: string
  }
  dispositivoTipo?: string
  marca?: string
  modelo?: string
  referencia?: string
  color?: string
  serie?: string
  motivoIngreso: string
  diagnostico?: string
  accesorios?: string
  estado?: RepairStatus
  costoEstimado?: number
  costoFinal?: number
  responsable?: string
  notas?: string
}
