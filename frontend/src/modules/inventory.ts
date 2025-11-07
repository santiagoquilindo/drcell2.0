export type InventoryProvider = {
  id: number
  nombre: string
  contacto?: string | null
  telefono?: string | null
  email?: string | null
  notas?: string | null
  createdAt?: string
}

export type InventoryItem = {
  id: number
  nombre: string
  categoria: string
  proveedorId: number | null
  proveedorNombre?: string | null
  stockActual: number
  stockMinimo: number
  precioCompra: number
  precioVenta: number
  descripcion?: string | null
  updatedAt?: string
}

export type InventoryAlert = {
  id: number
  nombre: string
  stockActual: number
  stockMinimo: number
}

export type InventoryFilter = 'todos' | 'bajo' | 'ok'

export const INVENTORY_SAMPLE_CATEGORIES = [
  'Pantallas y Display',
  'Baterías',
  'Flex y conectores',
  'Botones y chasis',
  'Audio y parlantes',
  'Cámaras',
  'Accesorios y cables',
] as const
