export type RepairStatus = 'ingresado' | 'diagnostico' | 'en_proceso' | 'listo' | 'entregado'

export type RepairClient = {
  id: number
  nombre: string
  documento: string | null
  telefono: string | null
  email: string | null
  direccion?: string | null
  notas?: string | null
}

export type RepairUpdate = {
  id: number
  estado: RepairStatus
  comentario: string | null
  registradoPor: string | null
  createdAt: string
}

export type PublicRepairUpdate = {
  id: number
  estado: RepairStatus
  comentario: string | null
  createdAt: string
}

export type RepairSummary = {
  id: number
  codigo: string
  estado: RepairStatus
  marca: string | null
  modelo: string | null
  dispositivoTipo: string | null
  motivoIngreso: string | null
  responsable: string | null
  createdAt: string
  updatedAt: string
  clienteId: number
  clienteNombre: string
  clienteTelefono: string | null
  costoEstimado: number
  costoFinal: number
}

export type Repair = {
  id: number
  codigo: string
  estado: RepairStatus
  dispositivoTipo: string | null
  marca: string | null
  modelo: string | null
  referencia: string | null
  color: string | null
  serie: string | null
  motivoIngreso: string | null
  diagnostico: string | null
  accesorios: string | null
  costoEstimado: number
  costoFinal: number
  responsable: string | null
  notas: string | null
  createdAt: string
  updatedAt: string
  cliente: RepairClient
  updates: RepairUpdate[]
}

export type RepairTracking = {
  codigo: string
  estado: RepairStatus
  dispositivo: string
  motivoIngreso: string | null
  diagnostico: string | null
  accesorios: string | null
  createdAt: string
  updatedAt: string
  updates: PublicRepairUpdate[]
}

export type RepairClientPayload = {
  nombre: string
  documento?: string
  telefono?: string
  email?: string
  direccion?: string
  notas?: string
}

export type RepairPayload = {
  client?: RepairClientPayload
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

export type RepairUpdatePayload = {
  estado: RepairStatus
  comentario?: string
  registradoPor?: string
}
